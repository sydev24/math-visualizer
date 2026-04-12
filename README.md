# Dự án Trực quan hóa Hàm số & Hồi quy (Math & Regression Visualizer)

Dự án này giúp bạn vẽ đồ thị toán học và tính toán các thuật toán Hồi quy (Linear, Polynomial) từ con số 0 bằng Đại số tuyến tính, không dùng thư viện Machine Learning có sẵn.

## 1. Yêu cầu hệ thống
- Đã cài đặt Python 3.7 trở lên.

## 2. Cách Cài đặt & Chạy dự án (Dành cho Windows)

Mở Terminal (hoặc PowerShell) tại thư mục chứa dự án và chạy lần lượt các lệnh sau:

**Bước 1: Tạo và kích hoạt môi trường ảo (Khuyên dùng)**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
**Bước 2: Cài đặt thư viện**

PowerShell
python -m pip install -r requirements.txt
Bước 3: Chạy Server Backend

PowerShell
python -m uvicorn main:app --reload
3. Tính năng chínhVẽ hàm số toán học (vd: sin(x)*x^2).Tính toán ma trận $\beta$ cho Linear và Polynomial Regression.Đồ thị Chart.js tích hợp Zoom (Lăn chuột) và Pan (Kéo thả).Đường đồ thị tự động vẽ dài ra vô tận khi người dùng thao tác Zoom/Pan.