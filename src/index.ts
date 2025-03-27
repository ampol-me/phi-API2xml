import { Elysia } from 'elysia';
import axios from 'axios';
import xml from 'xml';

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

  // ถ้ามีการเปลี่ยนแปลงข้อมูล
  if (JSON.stringify(currentData) !== JSON.stringify(previousData)) {
    console.log('Data updated:', currentData);
    previousData = currentData;  // อัปเดตข้อมูลที่เก็บไว้
  }
}, 5000);  // รอทุกๆ 5 วินาที

// สร้างเซิร์ฟเวอร์
const app = new Elysia()
  .get('/telemetrics', async ({ set }) => {
    const mockData = await fetchDataFromAPI();
    set.headers['Content-Type'] = 'application/xml';
    return convertToXML(mockData);
  })
  .listen(3000);

console.log('Server is running on http://localhost:3000');