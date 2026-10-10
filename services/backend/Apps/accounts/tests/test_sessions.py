"""Security: active sessions + sign out other sessions (Master: Settings §5)."""

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User, UserSession

PASSWORD = "Str0ng!Passw0rd"


class SessionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="o@x.com", password=PASSWORD, full_name="Owner",
                                             is_email_verified=True)

    def login(self, agent):
        resp = self.client.post(reverse("v1:accounts:auth:login"), {"email": "o@x.com", "password": PASSWORD},
                                format="json", HTTP_USER_AGENT=agent)
        self.assertEqual(resp.status_code, 200, resp.data)
        return resp.data

    def test_sign_out_other_sessions(self):
        laptop, phone = self.login("Laptop"), self.login("Phone")
        sessions_url = reverse("v1:accounts:users:sessions")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {laptop['access']}")
        data = self.client.get(sessions_url).data
        self.assertEqual(len(data["sessions"]), 2)
        self.assertEqual([s["user_agent"] for s in data["sessions"] if s["current"]], ["Laptop"])
        self.assertIsNotNone(data["last_sign_in"])

        self.assertEqual(self.client.post(reverse("v1:accounts:users:sign-out-others")).data["signed_out"], 1)
        # The phone's access and refresh tokens stop working; the laptop's still do.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {phone['access']}")
        self.assertEqual(self.client.get(sessions_url).status_code, 401)
        self.client.credentials()
        refresh = self.client.post(reverse("v1:accounts:auth:token-refresh"), {"refresh": phone["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {laptop['access']}")
        self.assertEqual(len(self.client.get(sessions_url).data["sessions"]), 1)

    def test_session_survives_refresh_rotation(self):
        tokens = self.login("Laptop")
        self.client.credentials()
        rotated = self.client.post(reverse("v1:accounts:auth:token-refresh"), {"refresh": tokens["refresh"]},
                                   format="json").data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated['access']}")
        sessions = self.client.get(reverse("v1:accounts:users:sessions")).data["sessions"]
        self.assertEqual((len(sessions), sessions[0]["current"]), (1, True))
        self.assertEqual(UserSession.objects.count(), 1)
