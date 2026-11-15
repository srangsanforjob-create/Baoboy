require('dotenv').config();
Const express = require('express');
Const line = require('@line/bot-sdk');
Const { createClient } = require('@supabase/supabase-js');
Const db = require('./src/db');
Const { parse } = require('./src/catalog');
Const { resolveMonth, addMonths, mlabel } = require('./src/months');
Const { monthsMessage, confirmMessage } = require('./src/flex');

Const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

Const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

Const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

Const reply = (replyToken, messages) => client.replyMessage({ replyToken, messages });
Const text = (t, quick) => ({ type: 'text', text: t, ...(quick ? { quickReply: { items: quick } } : {}) });

Const bkk = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

Const todayYm = () => bkk().slice(0, 7);
Const ymFor = (day) => (day >= +bkk().slice(8) ? todayYm() : addMonths(todayYm(), 1));
Const chatOf = (s) => s.groupId || s.roomId || s.userId;
Const ymQuick = (ym) => ({
  type: 'action',
  action: { type: 'message', label: mlabel(ym).slice(0, 20), text: `สรุป ${mlabel(ym)}` },
});

// Supabase Pending Orders Helpers
async function savePendingDb(chat, p) {
  Try {
    Const id = Math.random().toString(36).slice(2, 10);
    Const { error } = await supabase
      .from('pending_orders')
      .insert({ id, chat_id: chat, payload: p });
    If (error) {
      Console.error('savePendingDb error details:', error);
      Throw error;
    }
    Return id;
  } catch (err) {
    Console.error('savePendingDb exception:', err);
    Throw err;
  }
}

async function getPendingDb(chat, id) {
  If (!id) return null;
  Try {
    Const { data, error } = await supabase
      .from('pending_orders')
      .select('payload')
      .eq('id', String(id))
      .eq('chat_id', chat)
      .maybeSingle();
    If (error) {
      Console.error('getPendingDb error:', error);
      Return null;
    }
    Return data ? data.payload : null;
  } catch (err) {
    Console.error('getPendingDb exception:', err);
    Return null;
  }
}

async function updatePendingDb(chat, id, p) {
  Try {
    Const { error } = await supabase
      .from('pending_orders')
      .update({ payload: p })
      .eq('id', String(id))
      .eq('chat_id', chat);
    If (error) throw error;
  } catch (err) {
    Console.error('updatePendingDb exception:', err);
    Throw err;
  }
}

async function deletePendingDb(chat, id) {
  If (!id) return;
  Try {
    Const { error } = await supabase
      .from('pending_orders')
      .delete()
      .eq('id', String(id))
      .eq('chat_id', chat);
    If (error) console.error('deletePendingDb error:', error);
  } catch (err) {
    Console.error('deletePendingDb exception:', err);
  }
}

async function monthMsg(chat, ym) {
  Return monthsMessage([[ym, await db.listOrders(chat, ym)]]);
}

async function onSummary(ev, chat, rest) {
  Try {
    Const yms = (typeof db.monthsWithData === 'function') ? await db.monthsWithData(chat) : [];
    If (!rest) {
      If (!yms || !yms.length) return reply(ev.replyToken, [text('ยังไม่มีออเดอร์')]);
      Const list = [];
      For (const ym of yms.slice(-12)) list.push([ym, await db.listOrders(chat, ym)]);
      Return reply(ev.replyToken, [monthsMessage(list)]);
    }
    Const r = resolveMonth(rest, todayYm(), yms);
    If (r.kind === 'ok') return reply(ev.replyToken, [await monthMsg(chat, r.ym)]);
    If (r.kind === 'ask') return reply(ev.replyToken, [text('หมายถึงสรุปของเดือนไหนครับ?', r.options.map(ymQuick))]);
    Const recent = (yms.length ? yms : [todayYm()]).slice(-4).map(ymQuick);
    Return reply(ev.replyToken, [text(`ไม่แน่ใจว่าเดือนไหน ลองพิมพ์เช่น สรุป Nov / สรุป พ.ย. /สรุป เดือนหน้า`, recent)]);
  } catch (err) {
    Console.error('onSummary error:', err);
    Return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการดึงข้อมูลสรุป')]);
  }
}

async function onText(ev) {
  Try {
    Const t = ev.message.text.trim();
    Const chat = chatOf(ev.source);
    Const m = t.match(/^(?:สรุป\s*|(?:summary|sum)\b\s*)(.*)$/i);
    If (m) return onSummary(ev, chat, m[1].trim());
    
    Const p = parse(t);
    If (!p) return;
    P.ym = ymFor(p.day);
    P.status = 'order'; // เซ็ตสถานะเริ่มต้น
    Const id = await savePendingDb(chat, p);
    Return reply(ev.replyToken, [confirmMessage(p, id)]);
  } catch (err) {
    Console.error('onText error:', err);
    Try {
      Return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการบันทึกออเดอร์ กรุณาลองใหม่อีกครั้ง')]);
    } catch (e) {
      Console.error('Failed to reply error message:', e);
    }
  }
}

async function onPostback(ev) {
  Try {
    Const chat = chatOf(ev.source);
    Const d = new URLSearchParams(ev.postback.data);
    Const a = d.get('a');

    If (a === 'status') {
      Const o = await db.updateOrderStatus(chat, +d.get('o'), d.get('s'));
      If (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
      Return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
    }

    // แก้ไขตรงนี้ให้ใช้ updateOrderStatus แทน cycleStatus ที่ไม่มีอยู่จริง
    If (a === 'next' || a === 'del') {
      Let o;
      If (a === 'next') {
        Const currentOrder = await db.getOrder(chat, +d.get('o'));
        If (!currentOrder) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
        Const nextStatus = currentOrder.status === 'order' ? 'ออเดอร์แล้ว' : 'ยังไม่ได้ Order';
        O = await db.updateOrderStatus(chat, +d.get('o'), nextStatus);
      } else {
        O = await db.deleteOrder(chat, +d.get('o'));
      }
      If (!o) return reply(ev.replyToken, [text('ไม่พบรายการนี้แล้ว')]);
      Return reply(ev.replyToken, [await monthMsg(chat, o.ym)]);
    }

    Const id = d.get('p');
    If (!id) {
      Return reply(ev.replyToken, [text('คำสั่งไม่ถูกต้องหรือหมดอายุแล้ว')]);
    }

    Const p = await getPendingDb(chat, id);
    If (!p) {
      Return reply(ev.replyToken, [text('รายการนี้หมดอายุแล้ว กรุณาพิมพ์ใหม่')]);
    }

    If (a === 'cancel') {
      Await deletePendingDb(chat, id);
      Return reply(ev.replyToken, [text('ยกเลิกแล้ว')]);
    }

    If (a === 'ok') {
      Const items = [];
      P.items
        .filter((i) => i.pid !== null)
        .forEach((i) => {
          Const e = items.find((x) => x.pid === i.pid && x.isSupport === !!i.isSupport);
          If (e) e.q += i.q;
          Else items.push({ pid: i.pid, q: i.q, isSupport: !!i.isSupport });
        });
      
      Const orderStatus = p.status || 'ยังไม่ได้ Order';
      Await db.upsertOrder(chat, { ym: p.ym, day: p.day, status: orderStatus, items });
      Await deletePendingDb(chat, id);
      Return reply(ev.replyToken, [await monthMsg(chat, p.ym)]);
    }

    If (a === 'pick') p.items[+d.get('i')].pid = +d.get('c');
    Else if (a === 'mm') p.ym = addMonths(p.ym, +d.get('d'));

    Await updatePendingDb(chat, id, p);
    Return reply(ev.replyToken, [confirmMessage(p, id)]);
  } catch (err) {
    Console.error('onPostback error:', err);
    Try {
      Return reply(ev.replyToken, [text('เกิดข้อผิดพลาดในการทำรายการ')]);
    } catch (e) {
      Console.error('Failed to reply postback error:', e);
    }
  }
}

Const app = express();
App.get('/', (_, res) => res.send('Baoboy SUM bot is running'));

App.post(
  '/webhook',
  express.json({
    verify: (req, res, buf) => {
      Req.rawBody = buf;
    },
  }),
  async (req, res) => {
    Console.log('Webhook received:', JSON.stringify(req.body));
    Const signature = req.headers['x-line-signature'];
    If (!line.validateSignature(req.rawBody, config.channelSecret, signature)) {
      Console.error('Invalid signature!');
      Return res.status(401).send('Invalid signature');
    }

    Try {
      Await Promise.all(
        Req.body.events.map((ev) => {
          If (ev.type === 'message' && ev.message.type === 'text') return onText(ev);
          If (ev.type === 'postback') return onPostback(ev);
        })
      );
    } catch (e) {
      Console.error('Webhook execution error:', e);
    }
    Res.sendStatus(200);
  }
);

Db.init()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log('listening')))
  .catch((e) => {
    Console.error('Database init error:', e);
    Process.exit(1);
  });
