"""SES email backend: sends the raw message through SESv2 with the From and
every recipient; failures raise unless fail_silently."""

from unittest.mock import MagicMock, patch

from django.core.mail import EmailMessage, get_connection
from django.test import SimpleTestCase, override_settings


@override_settings(EMAIL_BACKEND="Apps.common.ses_email.SESEmailBackend",
                   DEFAULT_FROM_EMAIL="Nibbl <no-reply@joinnibbl.com>", AWS_SES_REGION="us-west-1")
class SESEmailBackendTests(SimpleTestCase):
    def test_sends_raw_message(self):
        client = MagicMock()
        with patch("boto3.client", return_value=client) as factory:
            sent = EmailMessage("Your code", "123456", to=["a@x.com"], cc=["b@x.com"]).send()
        self.assertEqual(sent, 1)
        factory.assert_called_once_with("sesv2", region_name="us-west-1")
        kwargs = client.send_email.call_args.kwargs
        self.assertEqual(kwargs["FromEmailAddress"], "Nibbl <no-reply@joinnibbl.com>")
        self.assertEqual(kwargs["Destination"], {"ToAddresses": ["a@x.com", "b@x.com"]})
        raw = kwargs["Content"]["Raw"]["Data"].decode()
        self.assertIn("Subject: Your code", raw)
        self.assertIn("123456", raw)

    def test_failure_raises_unless_silent(self):
        client = MagicMock()
        client.send_email.side_effect = RuntimeError("denied")
        with patch("boto3.client", return_value=client):
            with self.assertRaises(RuntimeError):
                EmailMessage("S", "B", to=["a@x.com"]).send()
            self.assertEqual(get_connection(fail_silently=True).send_messages([EmailMessage("S", "B", to=["a@x.com"])]), 0)
