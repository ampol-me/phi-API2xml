import { Elysia } from 'elysia';
import { Database } from 'bun:sqlite';
import axios from 'axios';
import net from 'net';

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
      <SeatData Name="${seat.seat_name}" MicrophoneActive="true" />
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
              <SeatData Name="${seat.seat_name}" MicrophoneActive="true" />
            </Seat>
          </ParticipantContainer>
        `).join('')}
      </Participants>
    </ActiveList>
  </Discussion>
</DiscussionActivity>`;

  return seatActivity + '\n' + discussionActivity;
};

// ฟังก์ชันดึงข้อมูลจาก API และอัปเดต SQLite
const fetchMicStatus = async () => {
  try {
    const response = await axios.get('http://10.115.206.10/api/speakers', {
      headers: {
        'Bosch-Sid': '8660da6b4c3e4c81c16b2f35f0671b14f19dfb8a232d6120410fa87f63b6bde865219a0b192f621c1d8ce51a3af5b69d37ac76901cb7cbf211d731287ff70f7f',
      },
    });

    const activeSeats = response.data;

    // รีเซ็ตค่าไมค์ทั้งหมดเป็น false ก่อน
    db.run('UPDATE mic_status SET mic_active = 0');

    // อัปเดตเฉพาะที่เปิดอยู่
    activeSeats.forEach(seat => {
      db.run(
        'INSERT INTO mic_status (seat_id, seat_name, mic_active) VALUES (?, ?, ?) ON CONFLICT(seat_id) DO UPDATE SET mic_active = ?',
        [seat.id, seat.seatName, true, true]
      );
    });

    // สร้าง XML ใหม่
    const newXML = generateXML();

    // ถ้า XML เปลี่ยนแปลง ค่อยอัปเดตและส่งให้ TCP Clients
    if (newXML !== lastMicStatus) {
      lastMicStatus = newXML;
      clients.forEach(client => client.write(newXML));
      console.log('🔄 Mic status updated');
    }
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