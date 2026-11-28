const { createClient } = require('@supabase/supabase-js');

let supabase;

async function init() {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
  console.log('Database initialized');
}

// ดึงรายการออเดอร์ทั้งหมดของเดือนนั้นๆ เรียงตามวัน
async function listOrders(chat, ym) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('chat_id', chat)
      .eq('ym', ym)
      .order('day', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('listOrders error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('listOrders exception:', err);
    return [];
  }
}

// ดึงรายการออเดอร์เดี่ยวตาม ID
async function getOrder(chat, id) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('chat_id', chat)
      .maybeSingle();

    if (error) {
      console.error('getOrder error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('getOrder exception:', err);
    return null;
  }
}

// เปลี่ยนจากการ upsert (ทับข้อมูลเดิมในวันนั้น) เป็น insert ใหม่ทุกครั้ง เพื่อให้ข้อมูลย้อนหลังไม่หาย
async function upsertOrder(chat, orderData) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        chat_id: chat,
        ym: orderData.ym,
        day: orderData.day,
        status: orderData.status || 'order',
        items: orderData.items,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('insertOrder error:', error);
      throw error;
    }
    return data || { ...orderData, chat_id: chat };
  } catch (err) {
    console.error('insertOrder exception:', err);
    throw err;
  }
}

// อัปเดตสถานะออเดอร์
async function updateOrderStatus(chat, id, status) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .eq('chat_id', chat)
      .select()
      .maybeSingle();

    if (error) {
      console.error('updateOrderStatus error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('updateOrderStatus exception:', err);
    return null;
  }
}

// ลบออเดอร์
async function deleteOrder(chat, id) {
  try {
    // ดึงข้อมูลก่อนลบเพื่อเอาค่า ym ไปใช้แสดงผลสรุปต่อ
    const order = await getOrder(chat, id);
    if (!order) return null;

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('chat_id', chat);

    if (error) {
      console.error('deleteOrder error:', error);
      return null;
    }
    return order;
  } catch (err) {
    console.error('deleteOrder exception:', err);
    return null;
  }
}

// ค้นหาเดือนที่มีข้อมูลออเดอร์อยู่
async function monthsWithData(chat) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('ym')
      .eq('chat_id', chat);

    if (error) {
      console.error('monthsWithData error:', error);
      return [];
    }
    const yms = [...new Set((data || []).map((x) => x.ym))].sort();
    return yms;
  } catch (err) {
    console.error('monthsWithData exception:', err);
    return [];
  }
}

module.exports = {
  init,
  listOrders,
  getOrder,
  upsertOrder,
  updateOrderStatus,
  deleteOrder,
  monthsWithData,
};
