# Baoboy SUM – LINE Order Bot

บอทรับออเดอร์ในกลุ่ม LINE: พิมพ์ออเดอร์ → การ์ดยืนยัน → การ์ดสรุปรายเดือน (Flex Message) + ยอดสะสมตามหมวด/สินค้า

## วิธีใช้ในกลุ่ม
| พิมพ์ | ผล |
|---|---|
| `15 L2 R1 order` | ออเดอร์วันที่ 15 (รอจัดส่ง) → ขึ้นการ์ดให้กดยืนยัน |
| `15 L2 R1 done` | จัดส่งแล้วรอชำระ |
| `15 L2 R1 paid` | ชำระแล้ว |
| `5 lagr 2 โรเซ 1 กระป๋อง 3` | พิมพ์ชื่อไทย/อังกฤษ/พิมพ์ผิดได้ ถ้าไม่ชัดบอทมีปุ่มให้เลือก |
| `สรุป` | การ์ดทุกเดือน (เลื่อนซ้าย-ขวา) |
| `สรุป Nov` `สรุป พ.ย.` `สรุป Nov 26` `สรุป พ.ย. 2569` `สรุป 11` `สรุป เดือนหน้า` (ปี: 26 = 2026, 2026, 2569 ใช้ได้หมด) | สรุปเดือนนั้น ถ้าไม่แน่ใจ (เช่น `สรุป ma`) บอทถามให้เลือก |

* รหัสลัด: `L` = Lager สด, `R` = Rose สด, `D` = Dunkel สด
* วันที่จัดส่ง **น้อยกว่าวันนี้ = เดือนถัดไป**, เท่ากับหรือมากกว่า = เดือนนี้ (เวลาไทย) ก่อนยืนยันกด ‹ เดือนก่อน / เดือนถัดไป › เปลี่ยนได้
* ออเดอร์วันเดียวกัน สถานะเดียวกัน จะรวมจำนวนในรายการเดียว
* บอทไม่ตอบข้อความทั่วไปในกลุ่ม ตอบเฉพาะรูปแบบออเดอร์และคำสั่ง `สรุป`

## ขั้นตอนติดตั้ง

### 1) สร้างบอท LINE
1. เข้า https://developers.line.biz/console → Create provider → Create **Messaging API** channel
2. แท็บ **Messaging API**: กด Issue **Channel access token (long-lived)** แล้วคัดลอก
3. แท็บ **Basic settings**: คัดลอก **Channel secret**
4. แท็บ Messaging API: ปิด *Auto-reply messages* และ *Greeting messages* (ที่ LINE Official Account Manager), เปิด **Allow bot to join group chats**

### 2) ฐานข้อมูล (ฟรี)
สมัคร https://supabase.com หรือ https://neon.tech → สร้างโปรเจกต์ → คัดลอก **connection string (Postgres)** เป็น `DATABASE_URL`
(ตารางสร้างให้อัตโนมัติตอนบอทเริ่มทำงาน)

### 3) ดีพลอย (ตัวอย่าง Render.com)
1. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub
2. Render → New → **Web Service** → เลือก repo
   * Build command: `npm install`  · Start command: `npm start`
3. Environment variables: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `DATABASE_URL`
4. ได้ URL เช่น `https://baoboy-sum.onrender.com`

### 4) ตั้ง Webhook
LINE Developers → Messaging API → **Webhook URL** = `https://<โดเมนของคุณ>/webhook` → กด Verify → เปิด **Use webhook**

### 5) ใช้งาน
สแกน QR ของบอทเพิ่มเป็นเพื่อน แล้วชวนเข้ากลุ่ม ลองพิมพ์ `15 L2 R1 order`

## หมายเหตุ
* Render แพ็กเกจฟรีจะ "หลับ" เมื่อไม่มีคนใช้ ข้อความแรกอาจช้า ใช้ UptimeRobot ping `/` ทุก 5 นาทีเพื่อกันหลับ
* การ์ดที่ส่งไปแล้วแก้ไขไม่ได้ เมื่อกดเปลี่ยนสถานะ บอทจะส่งการ์ดสรุปใบใหม่ลงมา
* ทดสอบ logic (ไม่ต้องต่อ LINE): `npm test`
* ทดสอบในเครื่อง: คัดลอก `.env.example` เป็น `.env` แล้ว `npm install && npm start` + `ngrok http 3000`
* ข้อมูลแยกตามกลุ่ม/ห้องแชท (chat id)
