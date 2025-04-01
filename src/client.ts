import { Elysia } from "elysia";
import net from "net";
import { parseStringPromise } from "xml2js";

const fetchXMLFromTCP = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let dataBuffer = "";

        console.log("Connecting to TCP Server...");

        client.connect(20000, "127.0.0.1", () => {
            console.log("Connected to TCP Server");
        });

        client.on("data", async (data) => {
            //console.log("Received data:", data.toString());

            const jsonData = await parseXMLToJSON( data.toString());

            console.log("Parsed JSON Data:", jsonData);
            dataBuffer += data.toString();
        });

        client.on("end", () => {
            console.log("TCP Server closed connection.");
            if (dataBuffer.trim()) {
                client.destroy();
                resolve(dataBuffer);
            } else {
                client.destroy();
                reject(new Error("Received empty response from TCP Server"));
            }
        });

        client.on("error", (err) => {
            console.error("TCP Client Error:", err.message);
            client.destroy();
            reject(err);
        });

        client.setTimeout(5000, () => {
            console.error("TCP Client Timeout: No response received.");
            client.destroy();
            reject(new Error("TCP Server did not respond in time"));
        });
    });
};

// ฟังก์ชันแปลง XML → JSON
const parseXMLToJSON = async (xmlData: string) => {
  try {
      const result = await parseStringPromise(xmlData, { explicitArray: false });

    //console.log("Parsed XML:", JSON.stringify(result, null, 2)); // เช็คโครงสร้าง JSON

      const seats: { Name: string; MicrophoneActive: boolean }[] = [];

      // ดึง SeatData จาก SeatActivity
      if (result.SeatActivity?.Seat?.SeatData?.$) {
          seats.push({
              Name: result.SeatActivity.Seat.SeatData.$.Name,
              MicrophoneActive: result.SeatActivity.Seat.SeatData.$.MicrophoneActive === "true",
          });
      }

      // ดึง SeatData จาก DiscussionActivity
      if (result.DiscussionActivity?.Discussion?.ActiveList?.Participants?.ParticipantContainer) {
          const participants = result.DiscussionActivity.Discussion.ActiveList.Participants.ParticipantContainer;
          const seatList = Array.isArray(participants) ? participants : [participants];

          seatList.forEach((participant) => {
              if (participant.Seat?.SeatData?.$) {
                  seats.push({
                      Name: participant.Seat.SeatData.$.Name,
                      MicrophoneActive: participant.Seat.SeatData.$.MicrophoneActive === "true",
                  });
              }
          });
      }

      return seats;
  } catch (error) {
      console.error("XML Parse Error:", error);
      throw new Error("Invalid XML format");
  }
};

// สร้าง API
const app = new Elysia()
    .get("/seats", async ({ set }) => {
        try {
            const xmlData = await fetchXMLFromTCP();
            //const jsonData = await parseXMLToJSON(xmlData);
            //console.log("Parsed JSON Data:", jsonData);
            set.headers["Content-Type"] = "application/xml";
            return xmlData;
        } catch (error) {
            console.error("Error:", error.message);
            set.status = 500;
            return { error: error.message };
        }
    })
    .listen(3002);

console.log("API running on http://localhost:3002/seats");