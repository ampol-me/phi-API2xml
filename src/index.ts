import { Elysia } from 'elysia';
import axios from 'axios';
import xml from 'xml';
import net from 'net';

// ตั้งค่าพอร์ต TCP
const TCP_PORT = 20000;
const HTTP_PORT = 3000;

// เก็บ client ที่เชื่อมต่อ TCP
const clients: net.Socket[] = [];

// ดึงข้อมูลจาก API
const fetchDataFromAPI = async () => {
  try {
    const response = await axios.get('http://10.115.206.10/api/speakers', {
      headers: {
        'Bosch-Sid': '88ea6b1d2e6d7375f1ee0e4c2750d2fe6ae45c7d4efe9d707564cf3eb593ab14f10b042f3b5f5b1b84366003de29fb14201271ac922a0e6fcc530e4a0a65def9',
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching data:', error);
    return [];
  }
};

// แปลงข้อมูลเป็น XML ตาม Bosch DCN
const convertToXML = (data) => {
  return xml(
    {
      SeatActivity: [
        {
          _attr: {
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
            Version: '1',
            TimeStamp: new Date().toISOString(),
            Topic: 'Seat',
            Type: 'SeatUpdated',
          },
        },
        ...data.map((seat) => ({
          Seat: [
            { _attr: { Id: seat.id } },
            {
              SeatData: {
                _attr: {
                  Name: seat.seatName,
                  MicrophoneActive: seat.micOn.toString(),
                  SeatType: 'Delegate',
                  IsSpecialStation: 'false',
                },
              },
            },
            {
              Participant: [
                { _attr: { Id: seat.participantId } },
                {
                  ParticipantData: {
                    _attr: {
                      Present: 'false',
                      VotingWeight: '1',
                      VotingAuthorisation: 'true',
                      MicrophoneAuthorisation: 'true',
                      FirstName: 'Unknown',
                      MiddleName: '',
                      LastName: 'Participant',
                      Title: 'Delegate',
                      Country: 'Unknown',
                      RemainingSpeechTime: '-1',
                      SpeechTimerOnHold: 'false',
                    },
                  },
                },
              ],
            },
            { IsResponding: 'false' },
          ],
        })),
      ],
    },
    { declaration: true }
  );
};

// สร้าง TCP Server รองรับ Multiple Clients
const tcpServer = net.createServer((socket) => {
  console.log(`✅ Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
  clients.push(socket);

  // ลบ client ออกจาก list เมื่อ disconnect
  socket.on('close', () => {
    console.log(`❌ Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    clients.splice(clients.indexOf(socket), 1);
  });

  socket.on('error', (err) => console.error('❌ Socket error:', err));
});

// เริ่ม TCP Server
tcpServer.listen(TCP_PORT, () => {
  console.log(`🚀 TCP Server listening on port ${TCP_PORT}`);
});

// ส่งข้อมูลไปยังทุก Client ที่เชื่อมต่ออยู่ทุก 5 วินาที
setInterval(async () => {
  const data = await fetchDataFromAPI();
  const xmlData = convertToXML(data);

  // Log Seat ID ที่เปิดไมค์อยู่
  const activeSeats = data.filter((seat) => seat.micOn).map((seat) => seat.id);
  if (activeSeats.length > 0) {
    console.log(`🎤 Active Seats: ${activeSeats.join(', ')}`);
  }

  // ส่ง XML ไปยังทุก Client
  clients.forEach((client) => {
    client.write(xmlData + '\n');
  });
}, 5000);

// API Server สำหรับตรวจสอบข้อมูล
const app = new Elysia()
  .get('/telemetrics', async ({ set }) => {
    const data = await fetchDataFromAPI();
    set.headers['Content-Type'] = 'application/xml';
    return convertToXML(data);
  })
  .listen(HTTP_PORT);

console.log(`🌐 HTTP API Server running on http://localhost:${HTTP_PORT}`);