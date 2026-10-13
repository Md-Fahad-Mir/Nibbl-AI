"""Account emails ship a branded HTML version next to the plain-text body."""

from django.core import mail
from django.test import TestCase

from Apps.accounts import emails


class EmailTemplateTests(TestCase):
    def _html(self):
        message = mail.outbox[-1]
        self.assertTrue(message.body)  # plain-text fallback kept
        (html, mimetype), = message.alternatives
        self.assertEqual(mimetype, "text/html")
        return html

    def test_code_email(self):
        emails.send_email_code(to_email="a@x.com", code="482913", purpose_label="Nibbl sign-in")
        html = self._html()
        self.assertIn("482913", html)
        self.assertIn("Your Nibbl sign-in code", html)

    def test_link_emails_have_a_button(self):
        url = "https://brand.joinnibbl.com/login/magic?token=abc&x=1"
        emails.send_magic_link(to_email="a@x.com", url=url)
        self.assertIn('href="https://brand.joinnibbl.com/login/magic?token=abc&amp;x=1"', self._html())
        emails.send_email_link(to_email="a@x.com", url=url)
        self.assertIn("Verify email", self._html())
        emails.send_referral_invite(to_email="a@x.com", friend_name="Sam", inviter_name="Alex", referral_code="ALEX1")
        self.assertIn("Hi Sam,", self._html())
