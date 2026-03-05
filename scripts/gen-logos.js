const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'frontend', 'static', 'logos');

const logos = [
  { file: 'stripe.svg', label: 'S', bg: '#635BFF' },
  { file: 'paypal.svg', label: 'P', bg: '#003087' },
  { file: 'square.svg', label: 'Sq', bg: '#3E4348' },
  { file: 'braintree.svg', label: 'Bt', bg: '#37B5A6' },
  { file: 'openai.svg', label: 'AI', bg: '#412991' },
  { file: 'anthropic.svg', label: 'A', bg: '#D4A574' },
  { file: 'gemini.svg', label: 'G', bg: '#8E75B2' },
  { file: 'cohere.svg', label: 'Co', bg: '#39594D' },
  { file: 'replicate.svg', label: 'R', bg: '#262626' },
  { file: 'groq.svg', label: 'G', bg: '#F55036' },
  { file: 'twilio.svg', label: 'T', bg: '#F22F46' },
  { file: 'sendgrid.svg', label: 'SG', bg: '#1A82E2' },
  { file: 'mailgun.svg', label: 'M', bg: '#F06B54' },
  { file: 'postmark.svg', label: 'Pm', bg: '#FFDE00', fg: '#1E1E1E' },
  { file: 'aws-s3.svg', label: 'S3', bg: '#569A31' },
  { file: 'aws-lambda.svg', label: '\u03BB', bg: '#FF9900' },
  { file: 'aws-ses.svg', label: 'SE', bg: '#DD344C' },
  { file: 'aws-cloudfront.svg', label: 'CF', bg: '#8C4FFF' },
  { file: 'auth0.svg', label: 'A0', bg: '#EB5424' },
  { file: 'clerk.svg', label: 'C', bg: '#6C47FF' },
  { file: 'firebase.svg', label: 'F', bg: '#FFCA28', fg: '#1E1E1E' },
  { file: 'supabase.svg', label: 'S', bg: '#3ECF8E' },
  { file: 'planetscale.svg', label: 'PS', bg: '#1A1A1A' },
  { file: 'mongodb.svg', label: 'M', bg: '#47A248' },
  { file: 'upstash.svg', label: 'U', bg: '#00E9A3', fg: '#1E1E1E' },
  { file: 'github.svg', label: 'GH', bg: '#181717' },
  { file: 'vercel.svg', label: 'V', bg: '#1A1A1A' },
  { file: 'netlify.svg', label: 'N', bg: '#00C7B7', fg: '#1E1E1E' },
  { file: 'cloudflare.svg', label: 'CF', bg: '#F38020' },
  { file: 'railway.svg', label: 'R', bg: '#0B0D0E' },
  { file: 'okta.svg', label: 'Ok', bg: '#007DC1' },
];

logos.forEach(({ file, label, bg, fg }) => {
  const textColor = fg || '#FFFFFF';
  const fontSize = label.length > 2 ? 13 : label.length === 2 ? 15 : 18;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">',
    `  <rect width="40" height="40" rx="8" fill="${bg}"/>`,
    `  <text x="20" y="20" fill="${textColor}" font-family="Inter,system-ui,sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="central">${label}</text>`,
    '</svg>',
  ].join('\n');
  fs.writeFileSync(path.join(dir, file), svg);
});

console.log(`Created ${logos.length} logo SVGs in ${dir}`);
