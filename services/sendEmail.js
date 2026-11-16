const nodemailer = require('nodemailer');

// EMAIL_* names are preferred: the legacy USER/HOST/PORT names collide with
// variables the OS already defines (e.g. USER is your login name on Linux/macOS).
const env = (name, legacyName) => process.env[name] || process.env[legacyName];

let transporter;

const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    service: env('EMAIL_SERVICE', 'SERVICE'),
    host: env('EMAIL_HOST', 'HOST'),
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: env('EMAIL_SECURE', 'SECURE') === 'true',
    auth: {
      user: env('EMAIL_USER', 'USER'),
      pass: env('EMAIL_PASSWORD', 'PASSWORD'),
    },
  });

  return transporter;
};

const sendEmail = async (user, subject, templateUsed, url) => {
  try {
    await getTransporter().sendMail({
      from: `"Chatify" <${env('EMAIL_USER', 'USER')}>`,
      to: user.email,
      subject,
      html: templateUsed(url, user.username),
    });
  } catch (error) {
    console.error(`Failed to send "${subject}" email:`, error.message);
  }
};

module.exports = sendEmail;
