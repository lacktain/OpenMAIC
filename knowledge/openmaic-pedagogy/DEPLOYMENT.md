# Deployment Notes for External Testing

This branch is intended to be cloned and run in a separate environment with its own keys, access controls, and storage.

## Recommended deployment path

### 1. Clone the pedagogical branch

```bash
git clone <your-writable-fork-or-mirror-url>
cd OpenMAIC
git checkout pedagogy-review-pipeline
```

### 2. Create environment file

```bash
cp .env.example .env.local
```

Fill in at minimum:
- one or more LLM provider keys
- `DEFAULT_MODEL`
- `ACCESS_CODE` for a protected shared deployment

Example minimum:

```env
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
DEFAULT_MODEL=google:gemini-3-flash-preview
ACCESS_CODE=replace-with-a-real-secret
```

### 3. Optional provider config file

If you prefer `server-providers.yml`, mount it in `docker-compose.yml` by uncommenting:

```yaml
# - ./server-providers.yml:/app/server-providers.yml:ro
```

### 4. Build and run with Docker Compose

```bash
docker compose up --build -d
```

### 5. Check status

```bash
docker compose ps
docker compose logs -f openmaic
```

Open:
- `http://<host>:3000`

## Notes for Azure swap testing

The updated `docker-compose.yml` now includes:
- explicit production environment variables
- named persistent data volume
- a simple internal healthcheck
- stable service/container naming for easier replacement

That should make it easier to swap the running container in an external Azure environment and test without depending on the LAN setup.

## Suggested external test flow

1. deploy this branch in a clean environment
2. configure fresh keys and access code there
3. run one real lesson-generation test
4. inspect:
   - whether blueprint review happens
   - whether revision rounds occur
   - whether final scenes reflect the approved pedagogical contract
5. compare output quality against the current Azure container version

## Current limitations

This branch is suitable for pilot testing, but it is still evolving.
Current strengths:
- real pedagogical blueprint gate before full generation
- hybrid SME / Merrill / Schön review flow
- persisted review artifacts in the stage/job path

Still evolving:
- stronger cloud-curriculum grounding
- deeper factual verification
- broader end-to-end evaluation of final lesson quality
