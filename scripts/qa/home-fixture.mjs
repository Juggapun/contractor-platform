/** Local, read-only visual fixtures. Never imported by application code. */
import http from 'node:http';
import { readFileSync } from 'node:fs';
const master = readFileSync(new URL('../../public/images/master-design-reference.png', import.meta.url)).toString('base64');
const slugs = ['สร้างบ้าน','รีโนเวท','โครงสร้าง','ไฟฟ้า','ประปา','งานระบบ','อื่นๆ'];
const categories = slugs.map((slug,i) => ({id:i+1,name_th:slug,name_en:slug,slug,icon:null}));
const provinces = [{id:1,name_th:'กรุงเทพมหานคร',slug:'bangkok'},{id:2,name_th:'นครพนม',slug:'nakhon-phanom'}];
const contractors = ['ช่างเอก รับสร้างบ้าน','ทีมช่างบ้านสวย','ส.ก่อสร้าง 2019','ช่างหลังคามืออาชีพ','ไฟฟ้าเทคโนโลยี'].map((name,i) => ({
  id:`fixture-${i}`,business_name:name,slug:`fixture-contractor-${i}`,description:'ข้อมูลตัวอย่างสำหรับตรวจหน้าตาเว็บเท่านั้น',
  cover_image_url: i === 4 ? null : `http://127.0.0.1:54329/cover-${i}.svg`,
  profile_image_url:`http://127.0.0.1:54329/cover-${i}.svg`,rating_avg:4.8-i/10,review_count:12+i,
  verification_status:'verified',provinces:provinces[i%2],districts:null,contractor_categories:[{categories:categories[i]}],
}));
const comments = ['หาช่างง่ายมาก ติดต่อได้สะดวก ดูผลงานก่อนตัดสินใจได้','ทีมงานให้คำแนะนำดี อธิบายรายละเอียดงานชัดเจน','ดูข้อมูลแล้วเปรียบเทียบช่างในพื้นที่ได้ง่ายขึ้น','มีภาพผลงานให้ดู ช่วยให้เลือกช่างได้ตรงกับงานที่ต้องการ','ชื่อและข้อความรีวิวยาวเพื่อทดสอบการตัดบรรทัดบนมือถือ ติดต่อช่างโดยตรงและคุยรายละเอียดก่อนเริ่มงานได้สะดวก','ตัวอย่างสำหรับตรวจปุ่มเลื่อนรีวิว ไม่ใช่ข้อมูลผู้ใช้งานจริง'];
const reviews = comments.map((comment,i) => ({id:`fixture-review-${i}`,rating:i%2?4:5,comment,contractors:{business_name:contractors[i%5].business_name,slug:contractors[i%5].slug}}));
const articles = ['10 ไอเดียต่อเติมบ้านให้คุ้มค่า','วิธีเลือกช่างหลังคาให้ได้งานคุณภาพ','แนวทางตกแต่งภายในสไตล์โมเดิร์น'].map((title,i) => ({id:`fixture-article-${i}`,title,facebook_post_url:'https://www.facebook.com/ChiphiEngineering/',cover_image_url:`http://127.0.0.1:54329/article-${i}.svg`,created_at:'2026-09-20T08:00:00Z'}));
http.createServer((req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Expose-Headers','Content-Range');
  if(req.method==='OPTIONS'){res.end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url = new URL(req.url,'http://localhost');
  const match = url.pathname.match(/^\/(cover|article)-(\d).svg$/);
  if(match){
    const i=Number(match[2]);
    const box = match[1]==='cover' ? `${35+i*151} 620 140 80` : `${[39,292,541][i]} 1618 112 94`;
    res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="400" height="240" overflow="hidden" preserveAspectRatio="xMidYMid slice"><image href="data:image/png;base64,${master}" width="815" height="1930"/></svg>`);return;
  }
  let data=[];
  if(!process.argv.includes('--empty')) {
    if(url.pathname.endsWith('/categories'))data=categories;
    if(url.pathname.endsWith('/provinces'))data=provinces;
    if(url.pathname.endsWith('/contractors'))data=url.searchParams.has('slug') ? contractors.filter(c=>'eq.'+c.slug===url.searchParams.get('slug')) : contractors;
    if(url.pathname.endsWith('/reviews'))data=reviews;
    if(url.pathname.endsWith('/articles'))data=articles;
    if(url.pathname.endsWith('/portfolio_images'))data=Array.from({length:20},(_,id)=>({id}));
  }
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Range',data.length?`0-${data.length-1}/${data.length}`:'*/0');
  res.end(req.method==='HEAD'?'':JSON.stringify(data));
}).listen(Number(process.env.QA_FIXTURE_PORT || 54329),'127.0.0.1');
