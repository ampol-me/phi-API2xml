import { Elysia } from 'elysia';
import { Database } from 'bun:sqlite';
import axios from 'axios';
import net from 'net';

const apiHost = '10.115.206.10'; //10.115.206.10 - localhost:3001
const Sid = 'ad159c93cd2704d18faf6cabd26b6bed8d6ff6fc77a5ae94d28907dc292fa8a5eea14d9b6c2f07a4ca24e2ed39a34a2228557b88a25a4d90888e32c077b5ef55'
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

function minifyXML(xml: string): string {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ") 
    .trim();
}

function splitXML(xml: string): string[] {
  return xml.split(/(?=<\?xml)/g).map(x => x.trim()); // แยกแต่ละ XML และตัดช่องว่าง
}

const generateXML = () => {
  const seats = db.query('SELECT * FROM mic_status WHERE mic_active = 1').all();
  
  // Get only the latest active seat
  const seatId_Digits = 4;
  const latestSeat = seats[seats.length - 1];
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() + 7);
  const formattedTimestamp = timestamp.toISOString().replace('Z', '+07:00');
  
  const seatActivity = `<?xml version="1.0" encoding="utf-8"?>
<SeatActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Seat" Type="SeatUpdated">
    ${latestSeat ? `
    <Seat Id="${latestSeat.seat_id.toString().padStart(1, '0')}">
      <SeatData Name="${latestSeat.seat_id.toString().padStart(seatId_Digits, '0')}" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
      <Participant Id="0">
            <ParticipantData Present="false" VotingWeight="1" VotingAuthorisation="true" MicrophoneAuthorisation="true" FirstName="" MiddleName="" LastName="${latestSeat.seat_id.toString().padStart(seatId_Digits, '0')}" Title="" Country="" RemainingSpeechTime="-1" SpeechTimerOnHold="false" />
        </Participant>
        <IsReposnding>false</IsReposnding>
    </Seat>` : ''}
</SeatActivity>`; 
const discussionActivity = `<?xml version="1.0" encoding="utf-8"?>
<DiscussionActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Discussion" Type="ActiveListUpdated">
  <Discussion Id="80">
        <ActiveList>
            <Participants>${seats.map(seat => `
                <ParticipantContainer Id="0">
                    <Seat Id="${seat.seat_id.toString().padStart(1, '0')}">
                        <SeatData Name="${seat.seat_id.toString().padStart(seatId_Digits, '0')}" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>`).join('')}
            </Participants>
        </ActiveList>
    </Discussion>
</DiscussionActivity>
`;

const testXml = `♣6♣<?xml version="1.0" encoding="utf-8"?><SeatActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Seat" Type="SeatUpdated"><Seat Id="6251"><SeatData Name="O1522" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" /><Participant Id="0"><ParticipantData Present="false" VotingWeight="1" VotingAuthorisation="true" MicrophoneAuthorisation="true" FirstName="" MiddleName="" LastName="O1522" Title="" Country="" RemainingSpeechTime="-1" SpeechTimerOnHold="false" /></Participant><IsReposnding>false</IsReposnding></Seat></SeatActivity>♥4       <?xml version="1.0" encoding="utf-8"?><DiscussionActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Discussion" Type="ActiveListUpdated"><Discussion Id="80"><ActiveList><Participants><ParticipantContainer Id="0"><Seat Id="5691"><SeatData Name="A101" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" /><IsReposnding>false</IsReposnding></Seat></ParticipantContainer><ParticipantContainer Id="0"><Seat Id="5842"><SeatData Name="F624" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" /><IsReposnding>false</IsReposnding></Seat></ParticipantContainer><ParticipantContainer Id="0"><Seat Id="6057"><SeatData Name="K1125" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" /><IsReposnding>false</IsReposnding></Seat></ParticipantContainer><ParticipantContainer Id="0"><Seat Id="6251"><SeatData Name="O1522" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" /><IsReposnding>false</IsReposnding></Seat></ParticipantContainer></Participants></ActiveList></Discussion></DiscussionActivity>`;


const t1 = `
<?xml version="1.0" encoding="utf-8"?>
<SeatActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Seat" Type="SeatUpdated">
    <Seat Id="5842">
        <SeatData Name="0002" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
        <Participant Id="0">
            <ParticipantData Present="false" VotingWeight="1" VotingAuthorisation="true" MicrophoneAuthorisation="true" FirstName="" MiddleName="" LastName="0001" Title="" Country="" RemainingSpeechTime="-1" SpeechTimerOnHold="false" />
        </Participant>
        <IsReposnding>false</IsReposnding>
    </Seat>
</SeatActivity>
<?xml version="1.0" encoding="utf-8"?>
<DiscussionActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Discussion" Type="ActiveListUpdated">
    <Discussion Id="80">
        <ActiveList>
            <Participants>
                <ParticipantContainer Id="0">
                    <Seat Id="5691">
                        <SeatData Name="0001" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
                <ParticipantContainer Id="0">
                    <Seat Id="5842">
                        <SeatData Name="0002" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
                <ParticipantContainer Id="0">
                    <Seat Id="6057">
                        <SeatData Name="0003" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
                <ParticipantContainer Id="0">
                    <Seat Id="6251">
                        <SeatData Name="0004" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
            </Participants>
        </ActiveList>
    </Discussion>
</DiscussionActivity>
`;

const t2 = `
<?xml version="1.0" encoding="utf-8"?>
<SeatActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Seat" Type="SeatUpdated">
    <Seat Id="5842">
        <SeatData Name="0002" MicrophoneActive="false" SeatType="Delegate" IsSpecialStation="false" />
        <Participant Id="0">
            <ParticipantData Present="false" VotingWeight="1" VotingAuthorisation="true" MicrophoneAuthorisation="true" FirstName="" MiddleName="" LastName="0001" Title="" Country="" RemainingSpeechTime="-1" SpeechTimerOnHold="false" />
        </Participant>
        <IsReposnding>false</IsReposnding>
    </Seat>
</SeatActivity>
<?xml version="1.0" encoding="utf-8"?>
<DiscussionActivity xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" Version="1" TimeStamp="${formattedTimestamp}" Topic="Discussion" Type="ActiveListUpdated">
    <Discussion Id="80">
        <ActiveList>
            <Participants>
                <ParticipantContainer Id="0">
                    <Seat Id="5691">
                        <SeatData Name="0001" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
                <ParticipantContainer Id="0">
                    <Seat Id="6057">
                        <SeatData Name="0003" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
                <ParticipantContainer Id="0">
                    <Seat Id="6251">
                        <SeatData Name="0004" MicrophoneActive="true" SeatType="Delegate" IsSpecialStation="false" />
                        <IsReposnding>false</IsReposnding>
                    </Seat>
                </ParticipantContainer>
            </Participants>
        </ActiveList>
    </Discussion>
</DiscussionActivity>
`;
   // Toggle between predefined XMLs (t1 and t2) every 5 seconds
   let toggle = true;
   setInterval(() => {
     toggle = !toggle;
   }, 5000);
 
   // Return minified XML based on toggle
   return toggle ? minifyXML(t1) : minifyXML(t2);
 // return minifyXML(seatActivity + discussionActivity);
};



// ฟังก์ชันดึงข้อมูลไมค์จาก API และอัปเดตฐานข้อมูล
const fetchMicStatus = async () => {
  try {
    const response = await axios.get(`http://${apiHost}/api/speakers`, {
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

    if (!hasChanged || activeSeats.length === 0) {
      return; // ไม่มีการเปลี่ยนแปลง หรือไม่มีไมค์เปิด ไม่ต้องอัปเดต XML หรือส่งให้ TCP Clients
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

    console.log(`🔄 Mic ID="${activeSeats[0].id}" status updated, sending XML to TCP clients`);

  } catch (error) {
    console.error('❌ Error fetching mic status:', error);
  }
};

setInterval(fetchMicStatus, 1000);

app.get('/mic/status', () => lastMicStatus || generateXML());

const clients: net.Socket[] = [];



const tcpServer = net.createServer((client) => {
 
  const clientAddress = `${client.remoteAddress}:${client.remotePort}`;


  clients.push(client);
  console.log(`✅ Client connected: ${clientAddress}`);
  console.log(`🔹 Total clients: ${clients.length}`);

 
  client.write(lastMicStatus || generateXML());

  client.on("data", (data: any) => {
    console.log("📥 Received Data:", data.toString());
    // Parse and process the XML data if needed
  });
  // กรณี client disconnect
  client.on("end", () => {
    clients.splice(clients.indexOf(client), 1);
    console.log(`❌ Client disconnected: ${clientAddress}`);
    console.log(`🔹 Total clients: ${clients.length}`);
  });

  console.log(`🔹 Sending XML to ${clientAddress}: ${lastMicStatus || generateXML()}`);
  
  client.on("error", (err) => {
    console.error(`⚠️ Error on ${clientAddress}:`, err.message);
  });
});

// เปิด TCP Server
tcpServer.listen(20000, () => {
  console.log("🚀 TCP Server running on port 20000");
});

// เริ่ม Elysia Server
app.listen(3000, () => console.log('API Server listening on port 3000'));