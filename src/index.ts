import { Elysia } from 'elysia';
import axios from 'axios';
import xml from 'xml';
import net from 'net';

// ตั้งค่าพอร์ต TCP ตาม Bosch DCN
const TCP_PORT = 20000;

// ฟังก์ชันดึงข้อมูลจาก API
const fetchDataFromAPI = async () => {
  try {
    const response = await axios.get('http://10.115.206.10/api/speakers', {
      headers: {
        'Bosch-Sid': '041186302e679c5baeecb4bd4f123d2bca71217e2b7c365cc2e0f177b3698a151d53bdc81af99456a91dd4a66b3ca875b591b4957d1b2db6f22dd42151ddb6a3',
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching data:', error);
    return [];
  }
};

// ฟังก์ชันแปลงข้อมูลเป็น XML (ตาม Bosch DCN)
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

// สร้าง TCP Server
const tcpServer = net.createServer((socket) => {
  console.log(`✅ Client connected from: ${socket.remoteAddress}:${socket.remotePort}`);

  // ส่งข้อมูลให้ client ทุกๆ 5 วินาที
  setInterval(async () => {
    const data = await fetchDataFromAPI();
    const xmlData = convertToXML(data);
    socket.write(xmlData + '\n'); // ส่ง XML ไปยัง client
  }, 5000);

  socket.on('close', () => console.log('❌ Client disconnected'));
  socket.on('error', (err) => console.error('❌ Socket error:', err));
});

// เริ่ม TCP Server ที่พอร์ต 20000
tcpServer.listen(TCP_PORT, () => {
  console.log(`🚀 TCP Server listening on port ${TCP_PORT}`);
});

// สร้าง API Server ด้วย Elysia.js
const app = new Elysia()
  .get('/', async ({ set }) => {
    const data = await fetchDataFromAPI();
    set.headers['Content-Type'] = 'application/xml';
    return convertToXML(data);
  })
  .listen(3000);

console.log('🌐 XML :Port 20000 - HTTP API Server running on http://localhost:3000');