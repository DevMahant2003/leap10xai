import time
import uuid
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask
import edge_tts

app = FastAPI()

VOICES = {
    "Sasurji": "hi-IN-SwaraNeural",
    "Management": "en-IN-PrabhatNeural",
    "Default": "en-IN-PrabhatNeural",
}


class TTSRequest(BaseModel):
    prompt: str
    voice: str = "Default"
    rate: str = "+35%"


def cleanup(path):
    if os.path.exists(path):
        os.remove(path)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/voices")
async def voices():
    return {"voices": list(VOICES.keys())}


@app.post("/generate")
async def generate(req: TTSRequest):
    voice = VOICES.get(req.voice, VOICES["Default"])
    path = f"output_{uuid.uuid4().hex[:8]}.mp3"
    try:
        start = time.time()
        communicate = edge_tts.Communicate(req.prompt, voice, rate=req.rate)
        await communicate.save(path)
        print(f"✅ Generated in {round(time.time() - start, 2)}s")
        return FileResponse(
            path,
            media_type="audio/mpeg",
            background=BackgroundTask(cleanup, path),
        )
    except Exception as e:
        cleanup(path)
        raise HTTPException(500, str(e))
