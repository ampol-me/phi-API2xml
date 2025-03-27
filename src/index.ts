import { Elysia } from 'elysia';
import axios from 'axios';
import xml from 'xml';

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

// setInterval(() => {
//   mockData = getRandomSeats();
//   console.log('Updated mockData:', mockData);
// }, 5000);

// ดึงข้อมูลจาก API
const fetchDataFromAPI = async () => {
  try {
    const response = await axios.get('http://10.115.206.10/api/speakers', {
      headers: {
        'Bosch-Sid': 'dc393fe11b74796acb422be783d021d471c357bc997e17c289e9962a1292c9ef2b53106888e70dd43e72284be1b4bec96e3ce330c6caebc952f5ebf61d0e359f',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return [];
  }
};

// แปลงข้อมูลเป็น XML
const convertToXML = (data) => {
  return xml({
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
              {
                Group: {
                  _attr: {
                    Name: '-',
                    RemainingGroupSpeechTime: '-1',
                    StopWatchState: 'STOPWATCH_IDLE',
                  },
                },
              },
            ],
          },
          { IsResponding: 'false' },
        ],
      })),
    ],
  }, { declaration: true });
};

// ตรวจสอบข้อมูลล่าสุดทุกๆ 5 วินาที
let previousData = [];

setInterval(async () => {
  const currentData = await fetchDataFromAPI();

  console.log(currentData);

  // ถ้ามีการเปลี่ยนแปลงข้อมูล
  if (JSON.stringify(currentData) !== JSON.stringify(previousData)) {
    console.log('Data updated:', currentData);
    previousData = currentData;  // อัปเดตข้อมูลที่เก็บไว้
  }
}, 5000);  // รอทุกๆ 5 วินาที

// สร้างเซิร์ฟเวอร์
const app = new Elysia()
  .get('/', async ({ set }) => {
    const Datas = await fetchDataFromAPI();
    set.headers['Content-Type'] = 'application/xml';
    return convertToXML(Datas);
  })
  .listen(3000);

console.log('Server is running on http://localhost:3000');