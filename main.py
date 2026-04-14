from __future__ import annotations

import io
import asyncio 
import httpx   
import logging
from typing import List
from contextlib import asynccontextmanager
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ml_engine import train_and_evaluate

# ==========================================
# CƠ CHẾ SELF-PING CHỐNG NGỦ ĐÔNG
# ==========================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml_visualizer")

APP_URL = "https://math-visualizer-7zi8.onrender.com/ping"
PING_INTERVAL = 10 * 60  # Ping mỗi 10 phút (600 giây)

async def keep_alive_task():
    """Luồng chạy ngầm giữ server luôn thức trên nền tảng Cloud."""
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            try:
                response = await client.get(APP_URL, timeout=10.0)
                logger.info(f"[Keep-Alive] Tự ping thành công. Status: {response.status_code}")
            except Exception as e:
                logger.warning(f"[Keep-Alive] Tự ping thất bại: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(keep_alive_task())
    yield
    task.cancel()

# ==========================================
# KHỞI TẠO ỨNG DỤNG
# ==========================================
app = FastAPI(
    title="ML Data Visualizer API",
    description="API xử lý pipeline dữ liệu CSV và huấn luyện mô hình hồi quy theo thời gian thực.",
    version="2.0.0",
    lifespan=lifespan 
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_index() -> FileResponse:
    return FileResponse("static/index.html")   

@app.get("/ping")
def keep_alive():
    return {"status": "alive", "message": "Server đang trực chiến!"}

# ==========================================
# SCHEMAS & ROUTES DATA
# ==========================================
class TrainRequest(BaseModel):
    """Schema request cho endpoint train."""
    x_data: List[float]
    y_data: List[float]
    model_type: str = Field(default="linear")
    degree: int = Field(default=2, ge=2, le=10)

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)) -> dict:
    """Xử lý file CSV đầu vào: Đọc, lọc NaN, giữ cột số."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file định dạng .csv.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File CSV đang rỗng.")

    try:
        raw_df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Không thể đọc CSV: {exc}") from exc

    if raw_df.empty:
        raise HTTPException(status_code=400, detail="CSV không có dữ liệu hợp lệ.")

    numeric_df = raw_df.select_dtypes(include=[np.number]).dropna(axis=0, how="any")

    if numeric_df.empty or numeric_df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="Không tìm thấy cột số hợp lệ sau khi lọc NaN.")

    return {
        "filename": file.filename,
        "rows": int(len(numeric_df)),
        "columns": numeric_df.columns.tolist(),
        "data": numeric_df.to_dict(orient="list"),
    }

@app.post("/train")
def train_model(req: TrainRequest) -> dict:
    """Huấn luyện mô hình Linear/Polynomial theo yêu cầu."""
    if len(req.x_data) != len(req.y_data):
        raise HTTPException(status_code=400, detail="x_data và y_data phải cùng số phần tử.")

    if len(req.x_data) < 2:
        raise HTTPException(status_code=400, detail="Cần tối thiểu 2 điểm dữ liệu.")

    model_type = req.model_type.lower().strip()
    if model_type not in {"linear", "polynomial"}:
        raise HTTPException(status_code=400, detail="model_type sai.")

    try:
        return train_and_evaluate(
            x_values=req.x_data,
            y_values=req.y_data,
            model_type=model_type,
            degree=req.degree,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc