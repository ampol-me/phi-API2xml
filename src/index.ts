import { Elysia } from 'elysia';
import { Database } from 'bun:sqlite';
import axios from 'axios';
import net from 'net';

const Sid = '8660da6b4c3e4c81c16b2f35f0671b14f19dfb8a232d6120410fa87f63b6bde865219a0b192f621c1d8ce51a3af5b69d37ac76901cb7cbf211d731287ff70f7f'
// สร้าง Database SQLite
const db = new Database('mic_control.db');
db.run(`
  CREATE TABLE IF NOT EXISTS mic_status (
    seat_id INTEGER PRIMARY KEY,
    seat_name TEXT,
    mic_active BOOLEAN
  )
`);

// เริ่มต้น Elysia API
const app = new Elysia();

// ตัวแปรเก็บสถานะล่าสุด
let lastMicStatus: string = '';

const generateXML = () => {
  const seats = db.query('SELECT * FROM mic_status WHERE mic_active = 1').all();
  
  const seatActivity = `
<?xml version="1.0" encoding="utf-8"?>
<SeatActivity Version="1" TimeStamp="${new Date().toISOString()}" Topic="Seat" Type="SeatUpdated">
  ${seats.map(seat => `
    <Seat Id="${seat.seat_id.toString().padStart(4, '0')}">
      <SeatData Name="${seat.seat_id.toString().padStart(4, '0')}" MicrophoneActive="true" />
    </Seat>
  `).join('')}
</SeatActivity>`;

  const discussionActivity = `
<?xml version="1.0" encoding="utf-8"?>
<DiscussionActivity Version="1" TimeStamp="${new Date().toISOString()}" Topic="Discussion" Type="ActiveListUpdated">
  <Discussion Id="71">
    <ActiveList>
      <Participants>
        ${seats.map(seat => `
          <ParticipantContainer Id="${seat.seat_id.toString().padStart(4, '0')}">
            <Seat Id="${seat.seat_id.toString().padStart(4, '0')}">
              <SeatData Name="${seat.seat_id.toString().padStart(4, '0')}" MicrophoneActive="true" />
            </Seat>
          </ParticipantContainer>
        `).join('')}
      </Participants>
    </ActiveList>
  </Discussion>
</DiscussionActivity>`;

  return seatActivity + '\n' + discussionActivity;
};

// ฟังก์ชันดึงข้อมูลไมค์จาก API และอัปเดตฐานข้อมูล
const fetchMicStatus = async () => {
  try {
    const response = await axios.get('http://10.115.206.10/api/speakers', {
      headers: {
        'Bosch-Sid': Sid,
      },
    });

    const activeSeats = response.data;

    // ดึงข้อมูลปัจจุบันจากฐานข้อมูล
    const currentSeats = db.query('SELECT seat_id FROM mic_status WHERE mic_active = 1').all().map(s => s.seat_id);
    const newSeats = activeSeats.map(s => s.id);

    // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
    const hasChanged = JSON.stringify(currentSeats.sort()) !== JSON.stringify(newSeats.sort());

    if (!hasChanged) {
      return; // ไม่มีการเปลี่ยนแปลง ไม่ต้องอัปเดต XML หรือส่งให้ TCP Clients
    }

    // รีเซ็ตสถานะไมค์ทั้งหมดเป็นปิด
    db.run('UPDATE mic_status SET mic_active = 0');

    // อัปเดตเฉพาะไมค์ที่เปิด
    activeSeats.forEach(seat => {
      db.run(
        'INSERT INTO mic_status (seat_id, seat_name, mic_active) VALUES (?, ?, ?) ON CONFLICT(seat_id) DO UPDATE SET mic_active = ?',
        [seat.id, seat.seatName, true, true]
      );
    });

    // สร้าง XML ใหม่
    const newXML = generateXML();
    lastMicStatus = newXML;

    // ส่งข้อมูลไปยัง TCP Clients
    clients.forEach(client => client.write(newXML));
    console.log('🔄 Mic status updated, sending XML to TCP clients');

  } catch (error) {
    console.error('❌ Error fetching mic status:', error);
  }
};

// เรียกใช้งาน fetchMicStatus ทุก 1 วินาที
setInterval(fetchMicStatus, 1000);

// API รับ XML ปัจจุบัน
app.get('/mic/status', () => lastMicStatus || generateXML());

// เริ่ม TCP Server
const clients: net.Socket[] = [];
const tcpServer = net.createServer(client => {
  clients.push(client);
  console.log('New TCP client connected');

  client.on('end', () => {
    clients.splice(clients.indexOf(client), 1);
  });

  // ส่ง XML ล่าสุดให้ client ใหม่ที่เชื่อมต่อ
  client.write(lastMicStatus || generateXML());
});
tcpServer.listen(20000, () => console.log('TCP Server listening on port 20000'));

// เริ่ม Elysia Server
app.listen(3000, () => console.log('API Server listening on port 3000'));