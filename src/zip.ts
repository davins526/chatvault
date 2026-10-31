// Simple STORE-only ZIP32. No dependency or network code. Bounded to <= 80 MiB by caller.
export type ZipEntry={name:string;data:Uint8Array};
function crc32(data:Uint8Array):number{
  let c=~0;for(const x of data){c^=x;for(let j=0;j<8;j++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (c^~0)>>>0;
}
export function buildZip(entries:ZipEntry[]):Blob{
  const enc=new TextEncoder();const names=entries.map(e=>enc.encode(e.name));
  const estimated=entries.reduce((v,e,i)=>v+e.data.byteLength+names[i].length*2+76,22);
  if(estimated>80*1024*1024)throw Error('Архив больше 80 МиБ. Для MVP скачайте проекты частями.');
  const out=new Uint8Array(estimated);const dv=new DataView(out.buffer);let pos=0;
  const offsets:number[]=[],crcs:number[]=[];
  for(let i=0;i<entries.length;i++){
    const e=entries[i],n=names[i],crc=crc32(e.data);offsets.push(pos);crcs.push(crc);
    dv.setUint32(pos,0x04034b50,true);dv.setUint16(pos+4,20,true);dv.setUint16(pos+6,0x800,true);
    dv.setUint16(pos+8,0,true);dv.setUint32(pos+14,crc,true);dv.setUint32(pos+18,e.data.byteLength,true);dv.setUint32(pos+22,e.data.byteLength,true);
    dv.setUint16(pos+26,n.length,true);pos+=30;out.set(n,pos);pos+=n.length;out.set(e.data,pos);pos+=e.data.length;
  }
  const centralStart=pos;
  for(let i=0;i<entries.length;i++){
    const e=entries[i],n=names[i];dv.setUint32(pos,0x02014b50,true);dv.setUint16(pos+4,20,true);dv.setUint16(pos+6,20,true);
    dv.setUint16(pos+8,0x800,true);dv.setUint32(pos+16,crcs[i],true);dv.setUint32(pos+20,e.data.length,true);dv.setUint32(pos+24,e.data.length,true);
    dv.setUint16(pos+28,n.length,true);dv.setUint32(pos+42,offsets[i],true);pos+=46;out.set(n,pos);pos+=n.length;
  }
  const cSize=pos-centralStart;
  dv.setUint32(pos,0x06054b50,true);dv.setUint16(pos+8,entries.length,true);dv.setUint16(pos+10,entries.length,true);
  dv.setUint32(pos+12,cSize,true);dv.setUint32(pos+16,centralStart,true);pos+=22;
  return new Blob([out.slice(0,pos)],{type:'application/zip'});
}
