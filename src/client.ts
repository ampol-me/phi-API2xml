import { Elysia } from 'elysia';
import { createConnection } from 'net';
import fs from 'fs';

// Function to trigger mic (Simulated as console.log for now)
function triggerMic(action: string) {
  if (action === 'on') {
    console.log("Mic triggered ON");
  } else if (action === 'off') {
    console.log("Mic triggered OFF");
  }
}

const app = new Elysia()
  .get('/start-client', async () => {
    const server = '127.0.0.1:20000'; // Bosch DCN IP and Port
    const command = '<Command><Action>RequestStatus</Action></Command>'; // Request command (or adjust as needed)

    try {
      const [host, port] = server.split(':');
      const client = createConnection({ host, port: Number(port) }, () => {
        console.log('Connected to Bosch DCN');
        client.write(command); // Send initial request command
      });

      let response = '';

      client.on('data', (data) => {
        response += data.toString();
      });

      client.on('end', () => {
        console.log('Connection closed');
        // Parse XML and trigger mic if action is detected
        if (response.includes('<MicStatus>on</MicStatus>')) {
          triggerMic('on');
        } else if (response.includes('<MicStatus>off</MicStatus>')) {
          triggerMic('off');
        }

        // Log the response in conlog.txt
        const conlogData = `Received at ${new Date().toISOString()}:\n${response}\n\n`;
        fs.appendFileSync('conlog.txt', conlogData);

        // Optionally send back a response to the client
        return { response };
      });

      client.on('error', (err) => {
        console.error('Error:', err.message);
        return { error: err.message };
      });

      // Wait until the client receives 'end' event before returning
      await new Promise((resolve) => client.on('end', resolve));

    } catch (err) {
      console.error('Error:', err);
      return { error: err.message };
    }
  })
  .listen(3002);

console.log('Server running on http://localhost:3002');