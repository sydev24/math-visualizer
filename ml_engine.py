"""ML Engine: chứa toàn bộ logic toán học và huấn luyện mô hình bằng scikit-learn."""

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import PolynomialFeatures


def train_and_evaluate(
    x_values: list[float],
    y_values: list[float],
    model_type: str = "linear",
    degree: int = 2,
) -> dict:
    """
    Huấn luyện mô hình hồi quy và trả về dữ liệu dùng để vẽ biểu đồ.

    Tham số:
    - x_values: Danh sách giá trị trục X (đặc trưng).
    - y_values: Danh sách giá trị trục Y (mục tiêu).
    - model_type: 'linear' hoặc 'polynomial'.
    - degree: Bậc đa thức khi dùng mô hình polynomial.

    Kết quả trả về:
    - line_x, line_y: 300 điểm mượt để vẽ đường dự đoán.
    - mse: Mean Squared Error trên tập train.
    - r2: R-squared trên tập train.
    """
    # Chuyển dữ liệu sang numpy để tương thích trực tiếp với scikit-learn.
    x_array = np.asarray(x_values, dtype=float)
    y_array = np.asarray(y_values, dtype=float)

    if x_array.ndim != 1 or y_array.ndim != 1:
        raise ValueError("Dữ liệu đầu vào phải là mảng 1 chiều.")

    if x_array.size != y_array.size:
        raise ValueError("x_values và y_values phải cùng kích thước.")

    if x_array.size < 2:
        raise ValueError("Cần tối thiểu 2 điểm dữ liệu để huấn luyện.")

    # sklearn yêu cầu X phải có shape (n_samples, n_features).
    x_train = x_array.reshape(-1, 1)

    # Xử lý tạo đặc trưng đa thức nếu người dùng chọn polynomial.
    if model_type == "polynomial":
        if not 2 <= degree <= 10:
            raise ValueError("Degree phải nằm trong khoảng từ 2 đến 10.")
        transformer = PolynomialFeatures(degree=degree, include_bias=False)
        x_features = transformer.fit_transform(x_train)
    else:
        transformer = None
        x_features = x_train

    # Huấn luyện mô hình hồi quy tuyến tính trên tập đặc trưng đã chuẩn bị.
    model = LinearRegression()
    model.fit(x_features, y_array)

    # Xác định miền giá trị X để dựng đường dự đoán mượt.
    x_min = float(np.min(x_array))
    x_max = float(np.max(x_array))

    # Nếu toàn bộ X trùng nhau, tạo khoảng giả để vẫn vẽ được đường.
    if np.isclose(x_min, x_max):
        x_min -= 1.0
        x_max += 1.0

    # Mở rộng thêm 5% biên hai đầu để biểu đồ nhìn thoáng hơn.
    padding = (x_max - x_min) * 0.05
    line_x = np.linspace(x_min - padding, x_max + padding, 300).reshape(-1, 1)

    # Biến đổi line_x theo cùng cách biến đổi tập train (nếu polynomial).
    if transformer is not None:
        line_x_features = transformer.transform(line_x)
    else:
        line_x_features = line_x

    # Dự đoán đường cong mượt 300 điểm để frontend vẽ line.
    line_y = model.predict(line_x_features)

    # Đánh giá chất lượng mô hình trên dữ liệu thực tế đã upload.
    y_pred = model.predict(x_features)
    mse = float(mean_squared_error(y_array, y_pred))
    r2 = float(r2_score(y_array, y_pred))

    return {
        "line_x": line_x.flatten().tolist(),
        "line_y": line_y.tolist(),
        "mse": round(mse, 6),
        "r2": round(r2, 6),
    }
