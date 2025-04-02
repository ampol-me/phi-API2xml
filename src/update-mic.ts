import { Elysia } from 'elysia';
import { readFile } from 'fs/promises';
import { parseStringPromise, Builder } from 'xml2js';

const app = new Elysia();

// ฟังก์ชันสุ่มค่า MicrophoneActive ตามอัตราส่วน 80% true, 20% false
const randomMicrophoneState = () => Math.random() < 0.8;

app.post('/update-microphone', async ({ body }) => {
    if (!body.xml) {
        return { error: 'Missing XML input' };
    }

    try {
        const parsedXml = await parseStringPromise(body.xml);
        
        const activeList = parsedXml?.DiscussionActivity?.Discussion?.[0]?.ActiveList?.[0]?.Participants?.[0]?.ParticipantContainer;
        const seatActivity = parsedXml?.SeatActivity;

        if (!activeList || !seatActivity) {
            return { error: 'Invalid XML structure' };
        }

        // ค้นหา SeatData Name ที่ต้องสุ่ม
        const candidates = activeList.map(p => p.Seat[0].SeatData[0]);
        
        if (candidates.length === 0) {
            return { error: 'No seats found' };
        }

        // เลือกสุ่มเปลี่ยนค่าเพียง 1 ตัว
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const selectedSeat = candidates[randomIndex];
        const newState = randomMicrophoneState();
        selectedSeat.$.MicrophoneActive = newState.toString();

        // อัปเดตใน SeatActivity ด้วย
        seatActivity.Seat.forEach(seat => {
            if (seat.SeatData[0].$.Name === selectedSeat.$.Name) {
                seat.SeatData[0].$.MicrophoneActive = newState.toString();
            }
        });

        // แปลงกลับเป็น XML
        const builder = new Builder();
        const updatedXml = builder.buildObject(parsedXml);

        return {
            updatedSeat: selectedSeat.$.Name,
            microphoneActive: newState,
            xml: updatedXml
        };
    } catch (error) {
        return { error: 'Failed to process XML', details: error.message };
    }
});

// เริ่ม Elysia Server
app.listen(3003, () => console.log('API Server listening on port 3003'));
