# ML Data Visualizer

Ứng dụng web cho phép người dùng tải file CSV, làm sạch dữ liệu bằng Pandas và trực quan hóa kết quả huấn luyện mô hình Machine Learning (Linear Regression / Polynomial Regression) theo thời gian thực.

## 1. Công nghệ sử dụng

### Backend
- Python 3
- FastAPI
- Pandas
- NumPy
- Scikit-learn
- python-multipart

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js

## 2. Cấu trúc dự án

```text
math_visualizer/
├─ main.py                  # Chứa route FastAPI và logic upload/xử lý file CSV
├─ ml_engine.py             # Chứa logic toán học và huấn luyện model bằng scikit-learn
├─ requirements.txt         # Danh sách thư viện Python cần cài
├─ README.md
└─ static/
   ├─ index.html            # Giao diện người dùng
   ├─ style.css             # Thiết kế UI (card, sidebar, chart panel)
   └─ script.js             # Logic frontend, gọi API và vẽ Chart.js
```

## 3. Luồng xử lý chính

1. Người dùng tải file `.csv`.
2. Backend đọc dữ liệu bằng Pandas.
3. Backend lọc dữ liệu:
- Loại bỏ toàn bộ dòng có NaN.
- Chỉ giữ các cột dữ liệu số.
4. Frontend nhận JSON dữ liệu và cho phép chọn:
- Trục X (Đặc trưng)
- Trục Y (Mục tiêu)
- Mô hình (Linear hoặc Polynomial)
- Degree (2 đến 10, chỉ hiện khi chọn Polynomial)
5. Mỗi lần người dùng đổi cấu hình (đặc biệt là kéo slider), frontend tự động gọi `/train` để huấn luyện lại ngay.
6. Backend trả về:
- 300 điểm mượt `line_x`, `line_y` để vẽ đường dự đoán
- Chỉ số `MSE` và `R²`
7. Frontend hiển thị:
- Scatter points: dữ liệu thật
- Line chart: đường dự đoán

## 4. Cài đặt và chạy dự án

### Bước 1: Tạo môi trường ảo 

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Bước 2: Cài thư viện

```powershell
python -m pip install -r requirements.txt
```

### Bước 3: Chạy server

```powershell
uvicorn main:app --reload
```

### Bước 4: Truy cập ứng dụng

Mở trình duyệt tại:

- http://127.0.0.1:8000

## 5. API chính

### `POST /upload`
Upload CSV và trả dữ liệu đã làm sạch.

Response mẫu:

```json
{
  "filename": "sample.csv",
  "rows": 120,
  "columns": ["feature_1", "target"],
  "data": {
    "feature_1": [1.1, 1.5, 1.9],
    "target": [2.0, 2.6, 3.1]
  }
}
```

### `POST /train`
Huấn luyện mô hình theo dữ liệu frontend gửi lên.

Request mẫu:

```json
{
  "x_data": [1.1, 1.5, 1.9],
  "y_data": [2.0, 2.6, 3.1],
  "model_type": "polynomial",
  "degree": 3
}
```

Response mẫu:

```json
{
  "line_x": [0.9, 0.91, 0.92],
  "line_y": [1.8, 1.85, 1.9],
  "mse": 0.012345,
  "r2": 0.987654
}
```

## 6. Ghi chú kỹ thuật

- Để thao tác kéo slider mượt, biểu đồ Chart.js được tắt animation (`animation: false`).
- Frontend dùng `AbortController` để hủy request train cũ khi người dùng kéo slider liên tục, giúp tránh nghẽn request.
- Khi dữ liệu trục X có giá trị trùng nhau hoàn toàn, backend tự mở rộng miền X để vẫn vẽ được đường dự đoán.

## 7. Hướng mở rộng

- Thêm chuẩn hóa dữ liệu (`StandardScaler`) trước khi train.
- Thêm chia tập train/test và đánh giá trên tập test.
- Hỗ trợ nhiều biến đầu vào (multiple features).
- Lưu lịch sử các lần chạy mô hình để so sánh kết quả.
