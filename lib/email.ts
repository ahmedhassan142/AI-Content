import nodemailer from 'nodemailer';

// Create transporter with better configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'ah770643@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'tzhixkiirkcpahrq',
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 24px; font-weight: bold; color: #7C3AED; }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%);
          color: white; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 20px 0;
          font-weight: bold;
        }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">✨ AI Content Writer</div>
        </div>
        <h2>Welcome, ${name}!</h2>
        <p>Thank you for signing up for AI Content Writer. Please verify your email address to get started.</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${verificationUrl}
        </p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account with us, you can safely ignore this email.</p>
        <div class="footer">
          <p>&copy; 2024 AI Content Writer. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Welcome to AI Content Writer!
    
    Hi ${name},
    
    Thank you for signing up. Please verify your email address by clicking the link below:
    
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account with us, you can safely ignore this email.
    
    Best regards,
    AI Content Writer Team
  `;

  await transporter.sendMail({
    from: `"AI Content Writer" <${process.env.EMAIL_FROM || 'noreply@ai-content-writer.com'}>`,
    to: email,
    subject: 'Verify Your Email Address - AI Content Writer',
    html: htmlContent,
    text: textContent,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to AI Content Writer</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .logo { font-size: 24px; font-weight: bold; color: #7C3AED; }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%);
          color: white; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 20px 0;
          font-weight: bold;
        }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">✨ AI Content Writer</div>
        </div>
        <h2>Welcome ${name}!</h2>
        <p>Your email has been verified successfully. You're now ready to start creating amazing content with AI.</p>
        <div style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
        </div>
        <p>With AI Content Writer, you can:</p>
        <ul>
          <li>Generate high-quality content in seconds</li>
          <li>Get SEO keyword suggestions</li>
          <li>Check grammar and plagiarism</li>
          <li>Export content in multiple formats</li>
        </ul>
        <div class="footer">
          <p>&copy; 2024 AI Content Writer. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"AI Content Writer" <${process.env.EMAIL_FROM || 'noreply@ai-content-writer.com'}>`,
    to: email,
    subject: 'Welcome to AI Content Writer! 🎉',
    html: htmlContent,
    text: `Welcome ${name}! Your email has been verified. Login to start creating content.`,
  });
}

export async function sendPasswordResetEmail({ email, name, resetUrl }: { email: string; name: string; resetUrl: string }) {
  await transporter.sendMail({
    from: `"AI Content Writer" <${process.env.EMAIL_FROM || 'noreply@ai-content-writer.com'}>`,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7C3AED;">Reset Your Password</h1>
        <p>Hi ${name},</p>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}