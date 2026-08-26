### Hexlet tests and linter status:
[![Actions Status](https://github.com/kolesnikova9292/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/kolesnikova9292/ai-for-developers-project-387/actions)

### Published application

https://event-types-app.onrender.com

### Docker

```bash
docker build -t event-types-app .
docker run --rm -p 4200:4200 -e PORT=4200 event-types-app
```

Frontend: `http://localhost:4200`  
Mock API proxy: `http://localhost:4200/api/...`

### Deploy on Render

Repository includes `render.yaml` (Blueprint).  
Create a new Blueprint service in Render from this repo â€” Render will build from `Dockerfile`.

`PORT` is provided by Render automatically, and the container starts the app on this port.