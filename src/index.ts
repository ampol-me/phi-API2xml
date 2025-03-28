import { Elysia } from 'elysia';
import axios from 'axios';
import xml from 'xml';
import net from 'net';

const TCP_PORT = 20000;
const HTTP_PORT = 3000;
const clients: net.Socket[] = [];


const getRandomSeats = () => {
  const seatCount = Math.floor(Math.random() * 2) + 1; // 1-2 seats
  const seats = [];
  for (let i = 0; i < seatCount; i++) {
    const seatId = Math.floor(Math.random() * 10) + 1; // Seat 1-10
    seats.push({
      name: `Seat ${seatId}`,
      prio: false,
      prioOn: false,
      seatName: `Seat ${seatId}`,
      micOn: Math.random() < 0.5,
      id: seatId,
      participantId: Math.floor(Math.random() * 100000)
    });
  }
  return seats;
};

let mockData = getRandomSeats();

setInterval(() => {
  mockData = getRandomSeats();
  //console.log('Updated mockData:', mockData);
}, 5000);

// ดึงข้อมูลจาก API
const fetchDataFromAPI = async () => {
  try {
    const response = await Promise.race([
      axios.get('http://10.115.206.10/api/speakers', {
        headers: {
          'Bosch-Sid': '35041dcce1ed5031a5831b65b784c2d432e5dfc699f217efa2da565048397706bf8a9b2cc625b7a683795298959561358406e74ecf0c8fdb484a02e5e2b43dee',
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
    ]);
    return response.data;
  } catch (error) {
    //console.error('❌ Error fetching data:', error);
    return mockData;
  }
};

// 🟢 SeatActivity XML
const generateSeatActivityXML = (data) => {
  return xml(
    {
      SeatActivity: [
        { _attr: { Version: '1', TimeStamp: new Date().toISOString(), Topic: 'Seat', Type: 'SeatUpdated' } },
        ...data.map((seat) => ({
          Seat: [
            { _attr: { Id: seat.id.toString().padStart(4, '0') } },
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
                      LastName: 'Participant',
                      Country: 'Thailand',
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

// 🔵 ParticipantActivity XML
const generateParticipantActivityXML = (data) => {
  return xml(
    {
      ParticipantActivity: [
        { _attr: { Version: '1', TimeStamp: new Date().toISOString(), Topic: 'Participant', Type: 'ParticipantUpdated' } },
        ...data.map((participant) => ({
          Participant: [
            { _attr: { Id: participant.participantId } },
            {
              ParticipantData: {
                _attr: {
                  Present: 'false',
                  VotingWeight: '1',
                  VotingAuthorisation: 'false',
                  MicrophoneAuthorisation: 'false',
                  FirstName: 'admin',
                  MiddleName: '',
                  LastName: '',
                  Title: '',
                  Country: '',
                  RemainingSpeechTime: '-1',
                  SpeechTimerOnHold: 'false',
                },
              },
            },
          ],
        })),
      ],
    },
    { declaration: true }
  );
};

// 🔴 DiscussionActivity XML
const generateDiscussionActivityXML = (data) => {
  return xml(
    {
      DiscussionActivity: [
        { _attr: { Version: '1', TimeStamp: new Date().toISOString(), Topic: 'Discussion', Type: 'RequestListUpdated' } },
        {
          Discussion: [
            { _attr: { Id: '162' } },
            {
              RequestList: [
                {
                  Participants: data.map((seat) => ({
                    ParticipantContainer: [
                      { _attr: { Id: seat.participantId } },
                      {
                        ParticipantData: {
                          _attr: {
                            Present: 'true',
                            VotingWeight: '1',
                            VotingAuthorisation: 'true',
                            MicrophoneAuthorisation: 'true',
                            FirstName: 'Peter',
                            LastName: 'Primary',
                            Title: 'First Speaker',
                            Country: 'USA',
                            RemainingSpeechTime: '-1',
                            SpeechTimerOnHold: 'false',
                          },
                        },
                      },
                      {
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
                          { IsResponding: 'false' },
                        ],
                      },
                    ],
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
    { declaration: true }
  );
};

// สร้าง TCP Server รองรับ Multiple Clients
const tcpServer = net.createServer((socket) => {
  console.log(`✅ Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
  clients.push(socket);

  socket.on('close', () => {
    console.log(`❌ Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    clients.splice(clients.indexOf(socket), 1);
  });

  socket.on('error', (err) => console.error('❌ Socket error:', err));
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`🚀 TCP Server listening on port ${TCP_PORT}`);
});

// ส่ง XML สลับกันไปทุก 5 วินาที
let xmlTypeIndex = 0;
const xmlGenerators = [generateSeatActivityXML, generateDiscussionActivityXML];

setInterval(async () => {
  const data = await fetchDataFromAPI();
  const xmlData = xmlGenerators[xmlTypeIndex](data);
  xmlTypeIndex = (xmlTypeIndex + 1) % xmlGenerators.length;

  // Log Seat ID ที่เปิดไมค์อยู่
  const activeSeats = data.filter((seat) => seat.micOn).map((seat) => seat.id);
  if (activeSeats.length > 0) {
    console.log(`🎤 Active Seats: ${activeSeats.join(', ')}`);
  }

  // ส่ง XML ไปยังทุก Client
  clients.forEach((client) => {
    client.write(xmlData + '\n');
  });
}, 2000);

// API Server สำหรับตรวจสอบข้อมูล XML
const app = new Elysia()
  .get('/telemetrics', async ({ set }) => {
    const data = await fetchDataFromAPI();
    set.headers['Content-Type'] = 'application/xml';
    return generateSeatActivityXML(data);
  })
  .listen(HTTP_PORT);

console.log(`🌐 HTTP API Server running on http://localhost:${HTTP_PORT}`);