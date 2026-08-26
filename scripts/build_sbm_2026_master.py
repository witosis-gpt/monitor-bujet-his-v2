"""Build the checked-in SBM master from the official PMK 32/2025 text extract.

Input is intentionally not committed. Download PMK 32/2025, extract text, then run this
script to reproduce data/sbm-2026.json. The application consumes only the JSON output.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
text = (ROOT / 'tmp/pdfs/sbm-2026.txt').read_text(encoding='utf-8')
provinces = ['ACEH','SUMATERA UTARA','RIAU','KEPULAUAN RIAU','JAMBI','SUMATERA BARAT','SUMATERA SELATAN','LAMPUNG','BENGKULU','BANGKA BELITUNG','BANTEN','JAWA BARAT','DKI JAKARTA','JAWA TENGAH','DI YOGYAKARTA','JAWA TIMUR','BALI','NUSA TENGGARA BARAT','NUSA TENGGARA TIMUR','KALIMANTAN BARAT','KALIMANTAN TENGAH','KALIMANTAN SELATAN','KALIMANTAN TIMUR','KALIMANTAN UTARA','SULAWESI UTARA','GORONTALO','SULAWESI BARAT','SULAWESI SELATAN','SULAWESI TENGAH','SULAWESI TENGGARA','MALUKU','MALUKU UTARA','PAPUA','PAPUA BARAT','PAPUA BARAT DAYA','PAPUA TENGAH','PAPUA SELATAN','PAPUA PEGUNUNGAN']

def clean_number(value): return int(value.replace('.', ''))
def block(start, end): return text[text.index(start):text.index(end, text.index(start))]
def rupiah_rows(section, expected):
    values = []
    for line in section.splitlines():
        found = re.findall(r'Rp([\d.]+)', line)
        if found: values.append([clean_number(item) for item in found])
    if len(values) < expected: raise ValueError(f'Expected {expected} rows, got {len(values)}')
    return values[:expected]

daily_rows = rupiah_rows(block('28.1 Uang Harian Perjalanan Dinas Dalam Negeri','28.2 Uang Representasi'), 38)
hotel_rows = rupiah_rows(block('30. SATUAN BIAYA PENGINAPAN PERJALANAN DINAS DALAM NEGERI','31. SATUAN BIAYA RAPAT'), 38)
terminal_rows = rupiah_rows(block('16. SATUAN BIAYA TRANSPORTASI DARI DAN/ATAU KE TERMINAL','17. SATUAN BIAYA TIKET PESAWAT'), 34)

daily = {province: {'luar_kota': row[0], 'dalam_kota_gt_8_jam': row[1], 'diklat': row[2], 'unit': 'OH'} for province, row in zip(provinces, daily_rows)}
hotel = {province: {'Pejabat Negara/Wamen/Eselon I': row[0], 'Pejabat Negara lainnya/Eselon II': row[1], 'Eselon III/Gol IV': row[2], 'Eselon IV/Gol III/II/I': row[3], 'unit': 'OH'} for province, row in zip(provinces, hotel_rows)}
terminal = {province: {'rate': row[0], 'unit': 'Orang/Kali'} for province, row in zip(provinces[:34], terminal_rows)}

flight_text = block('17. SATUAN BIAYA TIKET PESAWAT PERJALANAN DINAS DALAM NEGERI PERGI','18. SATUAN BIAYA TIKET PESAWAT')
flights = {}
flight_cities = sorted({
    'AMBON','BALIKPAPAN','BANDA ACEH','BANDAR LAMPUNG','BANJARMASIN','BATAM','BENGKULU','BIAK','DENPASAR','GORONTALO','JAKARTA','JAMBI','JAYAPURA','YOGYAKARTA','KENDARI','KUPANG','MAKASSAR','MALANG','MAMUJU','MANADO','MANOKWARI','MATARAM','MEDAN','PADANG','PALANGKARAYA','PALEMBANG','PALU','PANGKAL PINANG','PEKANBARU','PONTIANAK','SEMARANG','SOLO','SURABAYA','TERNATE','TIMIKA','TANJUNG SELOR','SORONG','TANJUNG PINANG','TANJUNG PANDAN','SILANGIT','LABUAN BAJO','BANYUWANGI','TARAKAN','LUBUK LINGGAU','PAGAR ALAM','BIMA','MAUMERE','ENDE','WAINGAPU','MERAUKE','NABIRE','FAKFAK','KUALA KURUN','SAMPIT','PANGKALAN BUN','KETAPANG','PUTUSSIBAU','SINTANG','SANGGAU','SUKADANA','TANJUNG REDEB','BONTANG','SAMARINDA','TENGGARONG','MALINAU','NUNUKAN','BULA','LANGGUR','TOBELO','MOROTAI','BAUBAU','LUWUK','POSO','TOLI TOLI','PALOPO','PARE PARE','WAMENA'
}, key=len, reverse=True)
for line in flight_text.splitlines():
    match = re.match(r'\s*\d+\.?\s+(.+?)\s+Rp([\d.]+)\s+Rp([\d.]+)', line)
    if not match: continue
    pair, business, economy = match.groups()
    origin = next((city for city in flight_cities if pair.startswith(f'{city} ')), None)
    if not origin: continue
    destination = pair[len(origin):].strip()
    if destination not in flight_cities: continue
    flights[f'{origin}|{destination}'] = {'origin': origin, 'destination': destination, 'business': clean_number(business), 'economy': clean_number(economy), 'unit': 'Orang/PP'}

ground_section = block('1. SATUAN BIAYA TRANSPORTASI DARAT DARI IBUKOTA PROVINSI', '2. SATUAN BIAYA TRANSPORTASI DARI DKI JAKARTA')
ground = []
for line in ground_section.splitlines():
    match = re.match(r'\s*\d+\.?\s+(.+?)\s+(Kab\.|Kota)\s+(.+?)\s+Orang/Kali\s+Rp([\d.]+)', line)
    if match:
        origin, kind, destination, rate = match.groups()
        ground.append({'origin': origin.strip(), 'destination': f'{kind} {destination.strip()}', 'rate': clean_number(rate), 'unit': 'Orang/Kali', 'one_way': True})

jakarta_section = block('2. SATUAN BIAYA TRANSPORTASI DARI DKI JAKARTA', '3. SATUAN BIAYA TRANSPOR KEGIATAN')
jakarta_ground = []
for line in jakarta_section.splitlines():
    match = re.match(r'\s*\d+\.?\s+(Jakarta)\s+(.+?)\s+Orang/Kali\s+Rp([\d.]+)', line)
    if match:
        origin, destination, rate = match.groups()
        jakarta_ground.append({'origin': origin, 'destination': destination.strip(), 'rate': clean_number(rate), 'unit': 'Orang/Kali', 'one_way': True})

meeting_sections = [
    block('a. Menteri, Setingkat Menteri dan Wakil Menteri', 'b. Pejabat Eselon I dan II/Pejabat Fungsional Utama'),
    block('b. Pejabat Eselon I dan II/Pejabat Fungsional Utama', 'c. Pejabat Eselon III/Pejabat Fungsional Madya Ke Bawah'),
    block('c. Pejabat Eselon III/Pejabat Fungsional Madya Ke Bawah', '31.2 Uang Harian Kegiatan Rapat/Pertemuan di Luar Kantor'),
]
meeting_groups = ['Menteri/Wamen', 'Eselon I/II/Fungsional Utama', 'Eselon III/Fungsional Madya ke bawah']
meeting = {province: {} for province in provinces}
for group, section in zip(meeting_groups, meeting_sections):
    for province, row in zip(provinces, rupiah_rows(section, 38)):
        meeting[province][group] = {'halfday': row[0], 'fullday': row[1], 'fullboard': row[2], 'unit': 'Orang/Paket'}

financial = {
    'KPA': {'<=1 miliar': 630000, '>1-10 miliar': 1180000, '>10-100 miliar': 1800000, '>100-500 miliar': 2860000, '>500 miliar': 3500000},
    'PPK': {'<=1 miliar': 610000, '>1-10 miliar': 1150000, '>10-100 miliar': 1750000, '>100-500 miliar': 2780000, '>500 miliar': 3390000},
    'PPSPM': {'<=1 miliar': 240000, '>1-10 miliar': 470000, '>10-100 miliar': 750000, '>100-500 miliar': 1470000, '>500 miliar': 1940000},
    'Bendahara Pengeluaran': {'<=1 miliar': 210000, '>1-10 miliar': 410000, '>10-100 miliar': 660000, '>100-500 miliar': 1280000, '>500 miliar': 1690000},
    'Staf Pengelola Keuangan/BPP': {'<=1 miliar': 160000, '>1-10 miliar': 300000, '>10-100 miliar': 490000, '>100-500 miliar': 950000, '>500 miliar': 1260000},
}
team = {
    'Keputusan Presiden': {'Pengarah':2500000, 'Penanggung Jawab':2250000, 'Koordinator/Ketua':2000000, 'Wakil Ketua':1750000, 'Sekretaris':1500000, 'Anggota':1500000},
    'Keputusan Menteri': {'Pengarah':1500000, 'Penanggung Jawab':1250000, 'Ketua':1000000, 'Wakil Ketua':850000, 'Sekretaris':750000, 'Anggota':750000},
    'Keputusan Eselon I': {'Pengarah':750000, 'Penanggung Jawab':700000, 'Ketua':650000, 'Wakil Ketua':600000, 'Sekretaris':500000, 'Anggota':500000},
    'Keputusan KPA': {'Pengarah':500000, 'Penanggung Jawab':450000, 'Ketua':400000, 'Wakil Ketua':350000, 'Sekretaris':300000, 'Anggota':300000},
}

master = {
    'version': '2026.2', 'year': 2026, 'source_regulation': 'PMK Nomor 32 Tahun 2025 tentang Standar Biaya Masukan Tahun Anggaran 2026',
    'source_url': 'https://jdih.kemenkeu.go.id/api/download/ccce2e9f-11fe-41ee-9da3-c7d42609b484/2025pmkeuangan032.pdf',
    'rates': {
        'daily_allowances': daily, 'accommodation': hotel, 'terminal_transport': terminal,
        'airline_pp_routes': flights, 'ground_transport': ground, 'jakarta_surrounding_ground_transport': jakarta_ground,
        'meeting_packages': meeting, 'fullboard_daily_allowance': {'rate': 130000, 'unit': 'OH'},
        'meeting_consumption': {'province': 'DKI JAKARTA', 'meal': {'rate':57000,'unit':'Orang/Kegiatan'}, 'snack':{'rate':24000,'unit':'Orang/Kegiatan'}},
        'professional_honorarium': {'Menteri/Pejabat Setingkat/Wamen':{'rate':1700000,'unit':'OJ'}, 'Eselon I/setara':{'rate':1400000,'unit':'OJ'}, 'Eselon II/setara':{'rate':1000000,'unit':'OJ'}, 'Eselon III ke bawah/setara':{'rate':900000,'unit':'OJ'}, 'Moderator':{'rate':700000,'unit':'Orang/Kegiatan'}, 'Pembawa Acara':{'rate':400000,'unit':'Orang/Kegiatan'}},
        'team_honorarium': team, 'financial_management_honorarium': financial
    }
}
(ROOT / 'data/sbm-2026.json').write_text(json.dumps(master, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'daily':len(daily),'hotel':len(hotel),'terminal':len(terminal),'flights':len(flights),'ground':len(ground),'jakarta_ground':len(jakarta_ground),'meeting':len(meeting),'team':len(team),'financial':len(financial)}))
