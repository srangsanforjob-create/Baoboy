const app = express();
app.get('/', (_, res) => res.send('Baoboy SUM bot is running'));

// 1. ใช้ express.json แบบเก็บ rawBody ไว้สำหรับ LINE SDK ตรวจสอบ Signature
app.post('/webhook', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}), async (req, res) => {
  // 2. ตรวจสอบ Signature ด้วยตัวเอง หรือใช้ line.validateSignature
  const signature = req.headers['x-line-signature'];
  if (!line.validateSignature(req.rawBody, config.channelSecret, signature)) {
    console.error('Invalid signature!');
    return res.status(401).send('Invalid signature');
  }

  try {
    await Promise.all(req.body.events.map((ev) => {
      if (ev.type === 'message' && ev.message.type === 'text') return onText(ev);
      if (ev.type === 'postback') return onPostback(ev);
    }));
  } catch (e) { 
    console.error(e); 
  }
  res.sendStatus(200);
});
