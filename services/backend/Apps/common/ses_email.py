"""Django email backend that sends through Amazon SES (API, not SMTP).

Credentials come from the standard AWS chain — on the production box that is
the EC2 instance role, which may only send as the verified joinnibbl.com
domain — so no SMTP password is stored. Bounces and complaints are handled by
SES's account-level suppression list (sends to those addresses are dropped).

Enable with:
    EMAIL_BACKEND=Apps.common.ses_email.SESEmailBackend
    DEFAULT_FROM_EMAIL="Nibbl <no-reply@joinnibbl.com>"
    AWS_SES_REGION=us-west-1
"""

import logging

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class SESEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self._client = None

    def _ses(self):
        if self._client is None:
            import boto3

            self._client = boto3.client("sesv2", region_name=settings.AWS_SES_REGION)
        return self._client

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages or []:
            recipients = message.recipients()
            if not recipients:
                continue
            try:
                self._ses().send_email(
                    FromEmailAddress=message.from_email or settings.DEFAULT_FROM_EMAIL,
                    Destination={"ToAddresses": recipients},
                    Content={"Raw": {"Data": message.message().as_bytes()}},
                )
                sent += 1
            except Exception:
                logger.exception("SES send failed (subject=%r)", message.subject)
                if not self.fail_silently:
                    raise
        return sent
