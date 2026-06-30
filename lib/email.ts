import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'PokerLLM <onboarding@resend.dev>'

/**
 * Send a verification email with a magic link.
 * Token expires in 15 minutes.
 */
export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/verify?token=${encodeURIComponent(token)}`
  const year = new Date().getFullYear()

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your PokerLLM account ♠',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email</title>
  <!--[if mso]>
  <style>table,td{border-collapse:collapse;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#ffffff;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- Card -->
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;border-radius:12px;overflow:hidden;background-color:#1a0a2e;box-shadow:0 2px 6px rgba(0,0,0,0.15),0 12px 32px rgba(26,10,46,0.2);">

    <!-- Top accent — gold gradient -->
    <tr><td style="height:4px;background:linear-gradient(90deg,#1a0a2e 0%,#C49630 25%,#FFD700 50%,#C49630 75%,#1a0a2e 100%);"></td></tr>

    <!-- Brand -->
    <tr><td style="padding:36px 40px 0;text-align:center;">
      <span style="font-family:Georgia,serif;font-size:14px;font-weight:700;letter-spacing:4px;color:#FFD700;text-transform:uppercase;">POKER</span><span style="font-family:Georgia,serif;font-size:14px;font-weight:700;letter-spacing:4px;color:#a78bfa;margin-left:3px;text-transform:uppercase;">LLM</span>
    </td></tr>

    <!-- Spade icon -->
    <tr><td style="padding:20px 40px 0;text-align:center;">
      <span style="font-size:32px;color:#FFD700;">&#9824;</span>
    </td></tr>

    <!-- Heading -->
    <tr><td style="padding:16px 40px 0;text-align:center;">
      <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">
        Verify your email
      </h1>
      <p style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#a78bfa;line-height:1.6;">
        You&rsquo;re one step away from the table.
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:24px 40px 0;">
      <div style="height:1px;background-color:#2d1656;"></div>
    </td></tr>

    <!-- Message -->
    <tr><td style="padding:20px 40px 0;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#c4b5e0;line-height:1.7;text-align:center;">
        Click the button below to confirm your email and activate your account.
      </p>
    </td></tr>

    <!-- CTA Button — gold -->
    <tr><td style="padding:28px 40px 0;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:#FFD700;">
            <a href="${verifyUrl}" target="_blank" style="display:block;padding:14px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#1a0a2e;text-decoration:none;letter-spacing:0.5px;">
              Verify Email
            </a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Timer badge -->
    <tr><td style="padding:20px 40px 0;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="padding:6px 14px;border-radius:6px;background-color:#2d1656;border:1px solid #3d2066;">
            <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#a78bfa;">
              Expires in</span><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#FFD700;font-weight:600;">15 minutes
            </span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:24px 40px 0;">
      <div style="height:1px;background-color:#2d1656;"></div>
    </td></tr>

    <!-- Fallback link -->
    <tr><td style="padding:16px 40px 0;text-align:center;">
      <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#7c6a9e;">
        Button not working? Copy this link:
      </p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:11px;color:#C49630;word-break:break-all;line-height:1.6;">
        ${verifyUrl}
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:28px 40px 24px;text-align:center;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#5b4a7a;line-height:1.6;">
        You received this because someone created a PokerLLM account with this email.<br/>
        If it wasn&rsquo;t you, you can safely ignore this.
      </p>
    </td></tr>

    <!-- Bottom accent — gold -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#1a0a2e 5%,#C49630 30%,#FFD700 50%,#C49630 70%,#1a0a2e 95%);"></td></tr>

  </table>

  <!-- Sub-footer -->
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
    <tr><td style="padding:20px 40px 0;text-align:center;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#8b7aa8;">
        &copy; ${year} PokerLLM
      </p>
    </td></tr>
  </table>

</td></tr>
</table>

</body>
</html>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send verification email:', error)
    return { success: false, error }
  }
}
