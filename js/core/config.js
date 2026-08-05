/**
 * PromptLib — EmailJS Configuration
 *
 * SETUP INSTRUCTIONS (takes ~5 minutes):
 *
 * 1. Go to https://www.emailjs.com and sign up for a free account.
 *
 * 2. In the EmailJS dashboard:
 *    a) Email Services → Add New Service → choose Gmail / Outlook / etc. → Connect.
 *       Copy the "Service ID" (looks like "service_xxxxxx") → paste into EMAILJS_SERVICE_ID below.
 *
 *    b) Email Templates → Create New Template.
 *       Set Subject to: Your PromptLib verification code
 *       Set Body (HTML or Text) to something like:
 *
 *         Hello {{to_name}},
 *
 *         Your verification code for PromptLib is:
 *
 *         {{otp}}
 *
 *         This code expires in 10 minutes. Do not share it with anyone.
 *
 *         — The PromptLib Team
 *
 *       In "To Email" field type: {{to_email}}
 *       Save. Copy the "Template ID" (looks like "template_xxxxxx") → paste into EMAILJS_TEMPLATE_ID below.
 *
 *    c) Account → API Keys → copy your "Public Key" → paste into EMAILJS_PUBLIC_KEY below.
 *
 * 3. Save this file. That's it — OTPs will now be sent to real email addresses.
 */

window.AppConfig = Object.freeze({
  EMAILJS_SERVICE_ID:          'service_vm6nrx7',
  EMAILJS_TEMPLATE_ID:         'template_pw3yojh',
  EMAILJS_NOTIFY_TEMPLATE_ID:  'YOUR_NOTIFY_TEMPLATE_ID',
  EMAILJS_PUBLIC_KEY:          'LxrJVSdl_w8kIELp3',

  ADMIN_EMAIL: 'venkata.pamidigantam@accenture.com',
  ADMIN_NAME:  'Admin',

  // Set to true only during local development to bypass real email sending.
  // MUST be false in any environment users can access.
  DEV_MODE: false,
});
