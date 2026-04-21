# ML Data Visualizer & Math Plotter

Một ứng dụng web mạnh mẽ cho phép trực quan hóa dữ liệu Machine Learning và đồ thị hàm số toán học theo thời gian thực. Ứng dụng hỗ trợ huấn luyện các mô hình hồi quy và tương tác trực tiếp trên biểu đồ.

## 1. Tính năng nổi bật

* **Học máy (ML Mode):**
    * Tải file CSV và tự động làm sạch dữ liệu (loại bỏ NaN, giữ cột số).
    * Chế độ **Nhập tay** hoặc **Click tạo điểm** trực tiếp trên đồ thị.
    * Huấn luyện hồi quy tuyến tính (Linear) và đa thức (Polynomial) thời gian thực.
* **Hàm số (Math Mode):** Vẽ đồ thị các hàm toán học phức tạp bằng thư viện `math.js`.
* **Tương tác thông minh:**
    * Zoom/Pan mượt mà trên biểu đồ.
    * Dự đoán giá trị Y từ giá trị X dựa trên mô hình đã huấn luyện.
    * Tự động tối ưu khung nhìn (Camera) cho từng chế độ: ML ôm sát dữ liệu, Math ép tỷ lệ 1:1.

## 2. Công nghệ sử dụng

### Backend
- **FastAPI:** Framework hiệu năng cao cho Python.
- **Pandas & NumPy:** Xử lý và làm sạch dữ liệu.
- **Scikit-learn:** Huấn luyện mô hình hồi quy.

### Frontend
- **Chart.js:** Hiển thị biểu đồ tương tác.
- **Math.js:** Phân tích cú pháp và tính toán hàm số.
- **Vanilla JS (ES6+):** Quản lý trạng thái và UI theo cấu trúc Modular.

## 3. Cấu trúc dự án

```text
math_visualizer/
├── backend/
│   ├── services/
│   │   ├── __init__.py
│   │   └── ml_engine.py      # Logic toán học & Scikit-learn
│   ├── __init__.py
│   ├── main.py             # Route API & xử lý File
│   └── schemas.py          # Khai báo kiểu dữ liệu (Pydantic)
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       ├── api.js      # Giao tiếp Fetch API
│   │       ├── chart.js    # Cấu hình & Reset Camera biểu đồ
│   │       ├── state.js    # Quản lý trạng thái ứng dụng
│   │       └── ui.js       # Xử lý sự kiện DOM & Giao diện
│   └── index.html          # Giao diện chính
├── .gitignore              # Cấu hình bỏ qua cache Python & venv
├── requirements.txt
└── README.md
## 4. Cài đặt và Chạy
Bước 1: Khởi tạo môi trường ảo
Bash
python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
# Linux/macOS
source .venv/bin/activate
Bước 2: Cài đặt thư viện
Bash
pip install -r requirements.txt
Bước 3: Khởi chạy Server
Bash
uvicorn backend.main:app --reload
Truy cập ứng dụng tại: http://127.0.0.1:8000

5. API chính
POST /upload: Tiếp nhận file CSV, trả về dữ liệu đã làm sạch.

POST /train: Nhận tọa độ X, Y và tham số mô hình, trả về phương trình, MSE, R² và các điểm vẽ đường dự đoán.

6. Ghi chú kỹ thuật
Responsive Camera: Hệ thống tự động tính toán lại trục tọa độ khi dữ liệu thay đổi để đảm bảo tính thẩm mỹ và độ chính xác của hình khối.

Modular JS: Code frontend được chia nhỏ thành các module chức năng, tránh xung đột và giúp dễ dàng bảo trì.

AbortController: Ngăn chặn tình trạng nghẽn request khi người dùng thay đổi cấu hình (kéo slider) liên tục.