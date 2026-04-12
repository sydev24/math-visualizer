from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, validator
import numpy as np
from typing import List, Optional

# Khởi tạo ứng dụng FastAPI
app = FastAPI()

# Mount thư mục "static" để FastAPI có thể trả về file giao diện (index.html)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Lớp kiểm tra dữ liệu đầu vào từ Frontend gửi lên
class RegressionRequest(BaseModel):
    type: str                     # 'linear' hoặc 'polynomial'
    degree: Optional[int] = 1     # Bậc đa thức (mặc định là 1 nếu là linear)
    X: List[List[float]]          # Mảng 2 chiều chứa các điểm x
    y: List[float]                # Mảng 1 chiều chứa các điểm y

    @validator('X', 'y')
    def check_valid_data(cls, v):
        # Kiểm tra không cho phép truyền lên giá trị NaN hoặc vô cực
        arr = np.array(v)
        if not np.isfinite(arr).all():
            raise ValueError("Dữ liệu chứa giá trị NaN hoặc vô cực")
        return v

@app.post("/regression")
def perform_regression(req: RegressionRequest):
    """
    API nhận dữ liệu X, y và trả về ma trận trọng số Beta
    """
    X_input = np.array(req.X)
    y_input = np.array(req.y)

    if len(X_input) != len(y_input):
        raise HTTPException(status_code=400, detail="Số lượng mẫu X và y không khớp.")

    n_samples = X_input.shape[0]

    # --- BƯỚC 1: XÂY DỰNG MA TRẬN THIẾT KẾ (DESIGN MATRIX X) ---
    if req.type == "linear":
        # Hồi quy tuyến tính: Thêm cột số 1 vào đầu mảng X để tạo hằng số Bias (Beta_0)
        # Ví dụ: X = [[x1], [x2]] => X_mat = [[1, x1], [1, x2]]
        X_mat = np.c_[np.ones(n_samples), X_input[:, 0]]
        
    elif req.type == "polynomial":
        # Hồi quy đa thức: Thêm các cột x^1, x^2, ..., x^degree
        # Ví dụ bậc 2: X_mat = [[1, x1, x1^2], [1, x2, x2^2]]
        X_mat = np.ones((n_samples, 1))
        for d in range(1, req.degree + 1):
            X_mat = np.c_[X_mat, X_input[:, 0]**d]
            
    else:
        raise HTTPException(status_code=400, detail="Loại hồi quy không hợp lệ")

    # --- BƯỚC 2: TÍNH TOÁN MA TRẬN TRỌNG SỐ BETA ---
    X_T = X_mat.T # X chuyển vị
    try:
        # Công thức chuẩn: Beta = (X^T * X)^-1 * X^T * y
        beta = np.linalg.inv(X_T @ X_mat) @ X_T @ y_input
    except np.linalg.LinAlgError:
        # Nếu (X^T * X) không thể nghịch đảo (định thức = 0), dùng nghịch đảo giả (Pseudo-inverse)
        beta = np.linalg.pinv(X_mat) @ y_input

    # Tính toán lại các điểm y dự đoán để kiểm tra
    predictions = X_mat @ beta

    return {
        "beta": beta.tolist(),
        "predictions": predictions.tolist()
    }