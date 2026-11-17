# 📱 CARA MEMBUKA APLIKASI DI IPHONE

## ✅ Langkah-Langkah (MUDAH):

### 1️⃣ Install Expo Go di iPhone
- Buka **App Store** di iPhone
- Cari **"Expo Go"**
- Download dan install

### 2️⃣ Jalankan Server di Laptop
**PILIH SALAH SATU CARA:**

#### **CARA A: Double-click file (PALING MUDAH)**
1. Buka folder: `c:\Users\Asus\Downloads\manuverpro-main (1)\manuverpro-main`
2. **Double-click** file: `start-expo.bat`
3. Tunggu sampai muncul **QR Code** di terminal

#### **CARA B: Pakai PowerShell**
1. Klik kanan pada folder proyek → "Open in Terminal"
2. Jalankan:
```powershell
.\start-expo.ps1
```

#### **CARA C: Manual**
```bash
cd "c:\Users\Asus\Downloads\manuverpro-main (1)\manuverpro-main"
node_modules\.bin\expo start --clear --tunnel
```

### 3️⃣ Scan QR Code dari iPhone
1. Buka **Expo Go** di iPhone
2. Tap tombol **"Scan QR Code"**
3. Arahkan kamera ke QR Code di layar laptop
4. Aplikasi akan otomatis terbuka!

---

## 🚨 Troubleshooting

### ❌ Error: "Port 8081 is being used"
**Solusi:**
1. Buka **Task Manager** (Ctrl+Shift+Esc)
2. Cari proses **"Node.js"**
3. Klik kanan → **End Task**
4. Jalankan ulang `start-expo.bat`

### ❌ Error: "Cannot connect to Metro"
**Solusi:**
Pastikan laptop dan iPhone terhubung ke **WiFi yang sama**!

Jika tetap tidak bisa, gunakan mode **tunnel**:
```bash
node_modules\.bin\expo start --tunnel
```

### ❌ QR Code tidak muncul
**Solusi:**
1. Pastikan command berjalan tanpa error
2. Tunggu 1-2 menit sampai Metro bundler selesai start
3. Jika tetap tidak muncul, jalankan:
```bash
node_modules\.bin\expo start --tunnel --web
```
Lalu buka browser, copy URL tunnel dan buka di iPhone Safari.

### ❌ Error: "There was a problem running this project"
**Kemungkinan penyebab:**
1. **Koneksi internet lambat** → gunakan mode `--tunnel`
2. **Versi Expo Go outdated** → update Expo Go di App Store
3. **Cache corrupt** → hapus folder `.expo` dan jalankan ulang

---

## 📝 Catatan Penting

### Fitur yang TIDAK TERSEDIA di Expo Go:
- ❌ GPS/Location (fitur "Cari teman nearby")
- ❌ Calendar (simpan jadwal match)
- ❌ Push Notifications
- ❌ Custom Date Picker

**Jika butuh fitur lengkap:**
1. Harus build **Custom Development Client**
2. Memerlukan **Apple Developer Account** ($99/tahun)
3. Command:
```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

---

## 📞 Jika Masih Bermasalah

Copy **seluruh output error** dari terminal dan kirim ke saya, contoh:
```
Error: Metro bundler failed to start
...
```

Sertakan juga:
1. Screenshot QR Code (jika muncul)
2. Screenshot error di iPhone (jika ada)
3. Versi Expo Go di iPhone (Settings → About)

