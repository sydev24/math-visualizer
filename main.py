
from __future__ import annotations

import io
from typing import List

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ml_engine import train_and_evaluate

# Khởi tạo FastAPI với metadata rõ ràng để dễ mở rộng tài liệu API sau này.
app = FastAPI(
    title="ML Data Visualizer API",
    description="API xử lý pipeline dữ liệu CSV và huấn luyện mô hình hồi quy theo thời gian thực.",
    version="1.0.0",
)

# Mount thư mục static để frontend có thể tải HTML/CSS/JS trực tiếp từ cùng một server.
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def read_index() -> FileResponse:
    """Trả về trang giao diện chính của ứng dụng."""
    return FileResponse("static/index.html")


class TrainRequest(BaseModel):
    """Schema request cho endpoint train."""

    x_data: List[float]
    y_data: List[float]
    model_type: str = Field(default="linear")
    degree: int = Field(default=2, ge=2, le=10)


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)) -> dict:
    """
    Data Pipeline:
    - Nhận file CSV từ frontend.
    - Đọc bằng Pandas.
    - Loại bỏ dòng chứa NaN.
    - Chỉ giữ cột dữ liệu số.
    - Trả về dữ liệu dạng JSON cho frontend.
    """
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

    # Bước lọc dữ liệu theo yêu cầu:
    # 1) Chỉ lấy cột số.
    # 2) Bỏ tất cả dòng có ít nhất một NaN.
    numeric_df = raw_df.select_dtypes(include=[np.number]).dropna(axis=0, how="any")

    if numeric_df.empty or numeric_df.shape[1] == 0:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy cột số hợp lệ sau khi lọc NaN.",
        )

    columns = numeric_df.columns.tolist()
    data_dict = numeric_df.to_dict(orient="list")

    return {
        "filename": file.filename,
        "rows": int(len(numeric_df)),
        "columns": columns,
        "data": data_dict,
    }


@app.post("/train")
def train_model(req: TrainRequest) -> dict:
    """
    Huấn luyện model theo cấu hình người dùng:
    - linear: Linear Regression.
    - polynomial: Linear Regression + PolynomialFeatures.
    """
    if len(req.x_data) != len(req.y_data):
        raise HTTPException(status_code=400, detail="x_data và y_data phải có cùng số phần tử.")

    if len(req.x_data) < 2:
        raise HTTPException(status_code=400, detail="Cần tối thiểu 2 điểm dữ liệu để huấn luyện.")

    model_type = req.model_type.lower().strip()
    if model_type not in {"linear", "polynomial"}:
        raise HTTPException(status_code=400, detail="model_type phải là 'linear' hoặc 'polynomial'.")

    try:
        return train_and_evaluate(
            x_values=req.x_data,
            y_values=req.y_data,
            model_type=model_type,
            degree=req.degree,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
# --- KEEP ALIVE (Chống ngủ đông) ---
@app.get("/ping")
def keep_alive():
    """
    Endpoint nhẹ dùng để các dịch vụ Uptime ping mỗi 14 phút, 
    giúp server Render gói Free không bị đưa vào trạng thái sleep.
    """
    return {"status": "alive", "message": "Tôi vẫn đang thức nhé!"}