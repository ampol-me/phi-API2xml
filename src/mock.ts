import { Elysia } from 'elysia';

const getRandomSeats = () => {
  const seatCount = Math.floor(Math.random() * 3) + 1; // 1-2 seats
  const seats = [];
  for (let i = 0; i < seatCount; i++) {
    const seatId = Math.floor(Math.random() * 100) + 1; // Seat 1-10
    seats.push({
      name: `Seat ${seatId}`,
      prio: false,
      prioOn: false,
      seatName: seatId.toString().padStart(4, '0'),
      micOn: Math.random() < 0.5,
      id: seatId,
      participantId: Math.floor(Math.random() * 100000)
    });
  }
  return seats;
};

// const predefinedSeats = [
//   { name: "K1125", id: 6057 },
//   { name: "A101", id: 5691 },
//   { name: "F624", id: 5842 }
// ];

// const getRandomSeats = () => {
//   const seatCount = Math.floor(Math.random() * 3) + 1; // 1-3 seats
//   const seats = [];
//   for (let i = 0; i < seatCount; i++) {
//     const randomSeat = predefinedSeats[Math.floor(Math.random() * predefinedSeats.length)];
//     seats.push({
//       ...randomSeat,
//       prio: false,
//       prioOn: false,
//       seatName: randomSeat.name,
//       micOn: Math.random() < 0.5,
//       participantId: Math.floor(Math.random() * 100000)
//     });
//   }
//   return seats;
// };




let mockData = getRandomSeats();

setInterval(() => {
  mockData = getRandomSeats();
  console.log('Updated mockData:', mockData);
}, 5000);

// const convertToXML = (data) => {
//   return xml({
//     SeatActivity: [
//       { _attr: {
//           'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
//           'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
//           Version: '1', run
//           TimeStamp: new Date().toISOString(),
//           Topic: 'Seat',
//           Type: 'SeatUpdated'
//         }
//       },
//       ...data.map(seat => ({
//         Seat: [
//           { _attr: { Id: seat.id } },
//           { SeatData: { _attr: {
//               Name: seat.seatName,
//               MicrophoneActive: seat.micOn.toString(),
//               SeatType: 'Delegate',
//               IsSpecialStation: 'false'
//             }
//           } },
//           { Participant: [
//             { _attr: { Id: seat.participantId } },
//             { ParticipantData: { _attr: {
//                 Present: 'false',
//                 VotingWeight: '1',
//                 VotingAuthorisation: 'true',
//                 MicrophoneAuthorisation: 'true',
//                 FirstName: 'Unknown',
//                 MiddleName: '',
//                 LastName: 'Participant',
//                 Title: 'Delegate',
//                 Country: 'Unknown',
//                 RemainingSpeechTime: '-1',
//                 SpeechTimerOnHold: 'false'
//               }
//             } },
//             { Group: { _attr: {
//                 Name: '-',
//                 RemainingGroupSpeechTime: '-1',
//                 StopWatchState: 'STOPWATCH_IDLE'
//               }
//             } }
//           ] },
//           { IsResponding: 'false' }
//         ]
//       }))
//     ]
//   }, { declaration: true });
// };

const app = new Elysia()
  .get('/api/speakers', () => mockData)
  .get('/seat', () => {
    return new Response(Bun.file('src/public/seatview.html'), {
      headers: { 'Content-Type': 'text/html' }
    });
  })
  // .get('/', ({ set }) => {
  //   set.headers['Content-Type'] = 'application/xml';
  //   return convertToXML(mockData);
  // })
  .listen(3001);

//console.log('Mock Server is running on http://localhost:3000');

console.log(
  `🦊 API2xml Server is running at ${app.server?.hostname}:${app.server?.port}`
);