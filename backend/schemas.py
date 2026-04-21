from pydantic import BaseModel, Field
from typing import List

class TrainRequest(BaseModel):
    """Schema request cho endpoint train (Chỉ nhận dữ liệu từ Frontend)"""
    x_data: List[float]
    y_data: List[float]
    model_type: str = Field(default="linear")
    degree: int = Field(default=2, ge=2, le=10)