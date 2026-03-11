// api/src/services/email.service.js
const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// Create reusable transporter
let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport(EMAIL_CONFIG);
    }
    return transporter;
}

// Email templates
const emailTemplates = {
    welcome: (data) => ({
        subject: `Welcome to Syncline, ${data.firstName}! 🎉`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Syncline</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e27;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0e27; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center;">
                            <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 30px; color: #fff;">⚡</span>
                            </div>
                            <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Welcome to Syncline!</h1>
                        </td>
                    </tr>
                    
                    <!-- Main content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #ffffff;">
                                Hi ${data.fullName}! 👋
                            </h2>
                            
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #94a3b8;">
                                Thank you for joining Syncline! We're thrilled to have you on board. 
                                ${data.accountType === 'company' 
                                    ? `Your company workspace <strong style="color: #a5b4fc;">${data.companyName}</strong> has been created successfully.`
                                    : 'Your personal account is ready to go!'}
                            </p>
                            
                            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0;">
                                <h3 style="margin: 0 0 15px; font-size: 18px; font-weight: 600; color: #a5b4fc;">
                                    ${data.accountType === 'company' ? '🚀 Get Started with Your Team' : '🎯 What You Can Do Now'}
                                </h3>
                                <ul style="margin: 0; padding: 0 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.8;">
                                    ${data.accountType === 'company' 
                                        ? `
                                        <li>Create and assign tasks to your team</li>
                                        <li>Invite team members to collaborate</li>
                                        <li>Monitor progress with real-time updates</li>
                                        <li>Generate reports and analytics</li>
                                        `
                                        : `
                                        <li>Create and organize your tasks</li>
                                        <li>Set priorities and deadlines</li>
                                        <li>Track your progress in real-time</li>
                                        <li>Stay productive and organized</li>
                                        `
                                    }
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin: 35px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                                   style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">
                                    Go to Dashboard →
                                </a>
                            </div>
                            
                            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0;">
                                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6ee7b7;">
                                    <strong>💡 Pro Tip:</strong> ${data.accountType === 'company' 
                                        ? 'Start by completing your company profile and inviting your first team member!'
                                        : 'Create your first task to get familiar with the interface!'}
                                </p>
                            </div>
                            
                            <p style="margin: 30px 0 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                                If you have any questions or need help getting started, feel free to reach out to our support team.
                            </p>
                            
                            <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                                Best regards,<br>
                                <strong style="color: #a5b4fc;">The Syncline Team</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: rgba(255, 255, 255, 0.03); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0 0 10px; font-size: 14px; color: #64748b;">
                                You're receiving this email because you signed up for Syncline.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #64748b;">
                                © ${new Date().getFullYear()} Syncline. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
        text: `
Welcome to Syncline, ${data.fullName}!

Thank you for joining Syncline! We're thrilled to have you on board.

${data.accountType === 'company' 
    ? `Your company workspace "${data.companyName}" has been created successfully.`
    : 'Your personal account is ready to go!'}

${data.accountType === 'company' ? 'Get Started with Your Team:' : 'What You Can Do Now:'}
${data.accountType === 'company' 
    ? `
- Create and assign tasks to your team
- Invite team members to collaborate
- Monitor progress with real-time updates
- Generate reports and analytics
    `
    : `
- Create and organize your tasks
- Set priorities and deadlines
- Track your progress in real-time
- Stay productive and organized
    `
}

Get Started: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard

Pro Tip: ${data.accountType === 'company' 
    ? 'Start by completing your company profile and inviting your first team member!'
    : 'Create your first task to get familiar with the interface!'}

If you have any questions or need help getting started, feel free to reach out to our support team.

Best regards,
The Syncline Team

© ${new Date().getFullYear()} Syncline. All rights reserved.
        `
    })
};

// Send welcome email
async function sendWelcomeEmail(userEmail, userData) {
    try {
        // Check if email is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('⚠️  Email not configured. Skipping welcome email.');
            return { success: false, error: 'Email not configured' };
        }

        const emailContent = emailTemplates.welcome(userData);
        
        const mailOptions = {
            from: `"Syncline" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        };

        const info = await getTransporter().sendMail(mailOptions);
        
        console.log('✅ Welcome email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Error sending welcome email:', error.message);
        return { success: false, error: error.message };
    }
}

// Verify email configuration
async function verifyEmailConfig() {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return { success: false, error: 'Email credentials not configured' };
        }
        
        await getTransporter().verify();
        console.log('✅ Email server connection verified');
        return { success: true };
    } catch (error) {
        console.error('❌ Email server verification failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendWelcomeEmail,
    verifyEmailConfig
};