# Elastic Beanstalk Cheap-First Deploy

Target: single-instance AWS Elastic Beanstalk in us-east-2, custom domain `imakeblogs.com`, HTTPS via Let’s Encrypt on the instance.

## What this setup keeps cheap
- No Application Load Balancer
- No AWS-managed database for launch
- No extra managed TLS service cost
- Existing Neon/Postgres and current S3 usage remain unchanged

## Expected monthly cost
- EB instance: about $8-12 for a small single-instance setup
- Route 53 hosted zone: about $0.50
- EBS storage: about $1 or a little more depending on size
- Data transfer: usually small at first, but can grow with traffic

Typical starter total: about $10-15/month.

## EB setup
1. Create or reuse an Elastic Beanstalk application.
2. Create a Web server environment.
3. Use Node.js on Amazon Linux 2023.
4. Keep it single-instance for the first launch.
5. Deploy the repository root so the root `package.json` and `Procfile` are used.

## Runtime settings
- `PORT` is already respected by the app start script.
- Add your production environment variables in the EB console.
- Make sure `imakeblogs.com` and `www.imakeblogs.com` are allowed in server CORS.

## HTTPS with Let’s Encrypt
The hook scripts are intended to:
- install certbot if the instance image does not already have it (`.platform/hooks/predeploy/00-install-certbot.sh`)
- detect the desired domain from EB environment variables
- install or use certbot if available
- request or renew a certificate for the custom domain
- reload nginx after the cert is in place

Suggested EB environment variables for the hook:
- `EB_SSL_DOMAIN=imakeblogs.com`
- `EB_SSL_EMAIL=you@example.com`

## Route 53
- Point the apex and `www` records at the EB environment endpoint.
- After the certificate is active, verify the domain resolves and redirects to HTTPS.

## Launch checklist
- Rotate any exposed AWS keys before going live.
- Add the prod database and API keys in EB environment variables.
- Confirm `/api/health` works on the EB URL.
- Confirm websocket auth and generation flows work from `https://imakeblogs.com`.
