# BidScout AI

BidScout is an AI opportunity intelligence MVP that helps small businesses quickly evaluate government procurement opportunities.

## MVP

- Opportunity feed with 0–100 scoring
- Source and quality filters
- Vercel-ready serverless API
- SAM.gov integration via `SAM_API_KEY`
- Demo fallback data when no API key is configured

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Add the environment variable `SAM_API_KEY`.
3. Deploy.

The app will use live SAM.gov opportunities when the API key is available and fall back to seed data otherwise.
