# Security policy

This is a static website (HTML, CSS and JavaScript) with no server, database or user accounts.

## Reporting a vulnerability
Email kingsleyroy14@gmail.com with details and steps to reproduce. Please do not open a public issue for security problems. I aim to reply within 3 working days.

## What is in place
- Strict Content-Security-Policy: scripts, styles, fonts and images load only from this site; the contact form may connect only to formsubmit.co
- All libraries and fonts are self-hosted (no third-party scripts or CDNs)
- Outbound links use `rel="noopener noreferrer"`; strict referrer policy
- Contact form: honeypot, input validation and length limits, send cooldown
- GitHub: CodeQL scanning and Dependabot enabled via workflows in `.github/`
