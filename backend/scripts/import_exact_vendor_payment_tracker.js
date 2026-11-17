const db = require('../config/database');

const rawData = [
  { sn: 1, vendor: "Elecktrick Engineers", site: "SIFY RABALE", type: "Service", invDate: "16.09.2026", invNo: "ETE/26-27/022", basic: 90000, gstRate: 18, gstAmt: 16200, totalAmt: 106200, tdsRate: 10, tdsAmt: 9000, payable: 97200, paid: 97200, bal: 0, status: "Paid", payDate: "12.10.2026", remarks: "" },
  { sn: 2, vendor: "License Payment Telangana", site: "HYD20 HYDERABAD", type: "Service", invDate: "", invNo: "ADV-HYD-TELANGANA", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 0, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "Statutory License Payment Telangana" },
  { sn: 3, vendor: "License Payment Andhra Pradesh", site: "HYD20 HYDERABAD", type: "Service", invDate: "", invNo: "ADV-HYD-ANDHRA", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 0, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "Statutory License Payment AP" },
  { sn: 4, vendor: "Krishaa Engineers", site: "GTPL LUMINA", type: "Supply", invDate: "16.09.2026", invNo: "KE27SO0105", basic: 179352, gstRate: 18, gstAmt: 32283, totalAmt: 211635, tdsRate: 0, tdsAmt: 0, payable: 211635, paid: 211636, bal: 0, status: "Paid", payDate: "", remarks: "Raychem Joints" },
  { sn: 5, vendor: "Roxtec India Private Limited", site: "GTPL LUMINA", type: "Supply", invDate: "01.09.2026", invNo: "PI/26-27/08", basic: 934000, gstRate: 18, gstAmt: 168120, totalAmt: 1102120, tdsRate: 0, tdsAmt: 0, payable: 1102120, paid: 1103300, bal: 0, status: "Paid", payDate: "14.10.2026", remarks: "" },
  { sn: 6, vendor: "EDVANTEST MEASURE TECHNOLOGIES PVT. LTD.", site: "TATA PALAYAM", type: "Supply", invDate: "09.10.2026", invNo: "1313", basic: 90985, gstRate: 18, gstAmt: 16377, totalAmt: 107362, tdsRate: 0, tdsAmt: 0, payable: 107362, paid: 107363, bal: 0, status: "Paid", payDate: "08.10.2026", remarks: "Tools for Tata Palayam" },
  { sn: 7, vendor: "R K Electricals", site: "SIFY RABALE", type: "Service", invDate: "16.06.2026", invNo: "RKE/ 18/26-27", basic: 855000, gstRate: 18, gstAmt: 153900, totalAmt: 1008900, tdsRate: 2, tdsAmt: 17100, payable: 991800, paid: 500000, bal: 491800, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 8, vendor: "Skystar", site: "GTPL LUMINA", type: "Service", invDate: "", invNo: "ADV-LUMINA-SKYSTAR", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 0, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "Service advance" },
  { sn: 9, vendor: "Bandarkar Auto Works And Engineers", site: "HYD20 HYDERABAD", type: "Service", invDate: "07.10.2026", invNo: "772", basic: 117367, gstRate: 18, gstAmt: 21126, totalAmt: 138493, tdsRate: 0, tdsAmt: 0, payable: 138493, paid: 138493, bal: 0, status: "Paid", payDate: "08.10.2026", remarks: "(SANTOSH ANANT BANDARKAR) An amount of ₹50,000 against this invoice has been paid to the concerned manager's personal bank account. The remaining invoice dues have been paid to the bank account details mentioned in the invoice." },
  { sn: 10, vendor: "Balaji Engineering", site: "HMCL DHARUHERA", type: "Service", invDate: "12.08.2026", invNo: "BE/2026-27/043", basic: 22500, gstRate: 18, gstAmt: 4050, totalAmt: 26550, tdsRate: 2, tdsAmt: 450, payable: 26100, paid: 13570, bal: 12530, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 11, vendor: "Singh Cable Solutions Of India", site: "SIFY RABALE", type: "Service", invDate: "01.08.2026", invNo: "SCS/026/2026-27", basic: 108000, gstRate: 18, gstAmt: 19440, totalAmt: 127440, tdsRate: 2, tdsAmt: 2160, payable: 125280, paid: 80000, bal: 45280, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 12, vendor: "VC Enterprises", site: "GTPL LUMINA", type: "Service", invDate: "18.08.2026", invNo: "VC/110/26-27", basic: 11000, gstRate: 18, gstAmt: 1980, totalAmt: 12980, tdsRate: 0, tdsAmt: 0, payable: 12980, paid: 12980, bal: 0, status: "Paid", payDate: "", remarks: "Rental Farana" },
  { sn: 13, vendor: "VOLTECH ENGINEERS PVT LTD", site: "ADANI WATER", type: "Service", invDate: "31.08.2026", invNo: "INV/DI045/26-27", basic: 412500, gstRate: 18, gstAmt: 74250, totalAmt: 486750, tdsRate: 10, tdsAmt: 41250, payable: 445500, paid: 0, bal: 445500, status: "Outstanding", payDate: "", remarks: "Testing and Commissioning of 66kV GIS" },
  { sn: 14, vendor: "VOLTECH ENGINEERS PVT LTD", site: "HMCL DHARUHERA", type: "Service", invDate: "31.08.2026", invNo: "INV/VI040/26-27", basic: 108000, gstRate: 18, gstAmt: 19440, totalAmt: 127440, tdsRate: 10, tdsAmt: 10800, payable: 116640, paid: 0, bal: 116640, status: "Outstanding", payDate: "", remarks: "Transformer Testing and Commissioning" },
  { sn: 15, vendor: "RAJESHWAR SALES CORPORATION", site: "ADANI WATER", type: "Supply", invDate: "17.08.2026", invNo: "GST/26-27/1403", basic: 21929, gstRate: 18, gstAmt: 3921, totalAmt: 25850, tdsRate: 0, tdsAmt: 0, payable: 25850, paid: 25850, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 16, vendor: "RAJESHWAR SALES CORPORATION", site: "ADANI WATER", type: "Supply", invDate: "19.08.2026", invNo: "GST/26-27/1436", basic: 1375, gstRate: 18, gstAmt: 235, totalAmt: 1610, tdsRate: 0, tdsAmt: 0, payable: 1610, paid: 1610, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 17, vendor: "RAJESHWAR SALES CORPORATION", site: "ADANI WATER", type: "Supply", invDate: "19.08.2026", invNo: "GST/26-27/1438", basic: 1570, gstRate: 18, gstAmt: 283, totalAmt: 1853, tdsRate: 0, tdsAmt: 0, payable: 1853, paid: 1853, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 18, vendor: "RAJESHWAR SALES CORPORATION", site: "ADANI WATER", type: "Supply", invDate: "11.09.2026", invNo: "GST/26-27/1677", basic: 2450, gstRate: 18, gstAmt: 441, totalAmt: 2891, tdsRate: 0, tdsAmt: 0, payable: 2891, paid: 2891, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 19, vendor: "ADORN SILVER ATELIER LLP", site: "Site not assigned", type: "Supply", invDate: "22.10.2026", invNo: "SB/2026-27/1157", basic: 960226, gstRate: 3, gstAmt: 28807, totalAmt: 989033, tdsRate: 0, tdsAmt: 0, payable: 989033, paid: 868524, bal: 120509, status: "Part Paid", payDate: "", remarks: "Shipping Charge -6000 (Purchase Gift for Diwali)" },
  { sn: 20, vendor: "Raj Electrical Contrator", site: "TATA PALAYAM", type: "Service", invDate: "24.09.2026", invNo: "08/2026-2027", basic: 1200000, gstRate: 18, gstAmt: 216000, totalAmt: 1416000, tdsRate: 10, tdsAmt: 120000, payable: 1296000, paid: 1200000, bal: 96000, status: "Part Paid", payDate: "", remarks: "ETG Work of 22OKV Switchyard at Tata Wind Power Palayam (RA BILL-01)" },
  { sn: 21, vendor: "Raj Electrical Contrator", site: "TATA PALAYAM", type: "Service", invDate: "25.09.2026", invNo: "10/2026/2027", basic: 20000, gstRate: 18, gstAmt: 3600, totalAmt: 23600, tdsRate: 10, tdsAmt: 2000, payable: 21600, paid: 0, bal: 21600, status: "Outstanding", payDate: "", remarks: "ETG Work of 22OKV Switchyard at Tata Palayam" },
  { sn: 22, vendor: "Sri Manjnatha Handling Service", site: "TATA KOPPAL", type: "Supply", invDate: "28.09.2026", invNo: "375", basic: 300000, gstRate: 18, gstAmt: 54000, totalAmt: 354000, tdsRate: 2, tdsAmt: 6000, payable: 348000, paid: 250000, bal: 98000, status: "Part Paid", payDate: "", remarks: "Freight Charge-4000) Transformer Unloading Idle Charge (01.09.26 to 30.09.2026)" },
  { sn: 23, vendor: "Singh Cable Solutions Of India", site: "SIFY RABALE", type: "Service", invDate: "01.08.2026", invNo: "SCS/000/2026-27", basic: 4000, gstRate: 0, gstAmt: 0, totalAmt: 4000, tdsRate: 0, tdsAmt: 0, payable: 4000, paid: 0, bal: 4000, status: "Outstanding", payDate: "", remarks: "Travel Charge" },
  { sn: 24, vendor: "UNIPROMPT TECHNICAL SERVICES PVT LTD", site: "HMCL DHARUHERA", type: "Service", invDate: "28.09.2026", invNo: "055UPNK2627", basic: 42500, gstRate: 18, gstAmt: 7650, totalAmt: 50150, tdsRate: 10, tdsAmt: 4250, payable: 45900, paid: 45900, bal: 0, status: "Paid", payDate: "30.09.2026", remarks: "Testing & Commissioning work of CRP & SAS panels" },
  { sn: 25, vendor: "Suresh Alazhu A", site: "TATA PALAYAM", type: "Service", invDate: "", invNo: "ADV-PALAYAM-DG", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 20500, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "DG Advance Payment" },
  { sn: 26, vendor: "FEONIX INFOTECH", site: "GTPL LUMINA", type: "Supply", invDate: "07.10.2026", invNo: "FI/26-27/1987", basic: 105000, gstRate: 18, gstAmt: 18900, totalAmt: 123900, tdsRate: 0, tdsAmt: 0, payable: 123900, paid: 123900, bal: 0, status: "Paid", payDate: "", remarks: "FO Cable" },
  { sn: 27, vendor: "JANPATH ENTERPRISE", site: "ADANI WATER", type: "Service", invDate: "05.10.2026", invNo: "JE/26-27/018", basic: 250000, gstRate: 18, gstAmt: 45000, totalAmt: 295000, tdsRate: 1, tdsAmt: 2500, payable: 292500, paid: 292500, bal: 0, status: "Paid", payDate: "", remarks: "Consultation charges cleared as per approval." },
  { sn: 28, vendor: "Rebiable Portable Cabin", site: "TATA KOPPAL", type: "Supply", invDate: "11.10.2026", invNo: "73/2026-27", basic: 90000, gstRate: 18, gstAmt: 16200, totalAmt: 106200, tdsRate: 0, tdsAmt: 0, payable: 106200, paid: 106200, bal: 0, status: "Paid", payDate: "", remarks: "Portable Cabin" },
  { sn: 29, vendor: "GANESH TRADING COMPANY", site: "GTPL LUMINA", type: "Supply", invDate: "05.10.2026", invNo: "GTC/1705/26-27", basic: 1410, gstRate: 5, gstAmt: 71, totalAmt: 1481, tdsRate: 0, tdsAmt: 0, payable: 1481, paid: 1481, bal: 0, status: "Paid", payDate: "28.10.2026", remarks: "" },
  { sn: 30, vendor: "GANESH TRADING COMPANY", site: "GTPL LUMINA", type: "Supply", invDate: "07.10.2026", invNo: "GTC/1735/26-27", basic: 1800, gstRate: 18, gstAmt: 324, totalAmt: 2124, tdsRate: 0, tdsAmt: 0, payable: 2124, paid: 2124, bal: 0, status: "Paid", payDate: "28.10.2026", remarks: "" },
  { sn: 31, vendor: "GANESH TRADING COMPANY", site: "HYD20 HYDERABAD", type: "Supply", invDate: "08.10.2026", invNo: "GTC/1744/26-27", basic: 12290, gstRate: 18, gstAmt: 1608, totalAmt: 13898, tdsRate: 0, tdsAmt: 0, payable: 13898, paid: 13898, bal: 0, status: "Paid", payDate: "28.10.2026", remarks: "" },
  { sn: 32, vendor: "Rakesh Electricals", site: "TATA KOPPAL", type: "Supply", invDate: "07.10.2026", invNo: "952/2026-27", basic: 40000, gstRate: 18, gstAmt: 7200, totalAmt: 47200, tdsRate: 0, tdsAmt: 0, payable: 47200, paid: 47200, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 33, vendor: "Rakesh Electricals", site: "HYD20 HYDERABAD", type: "Supply", invDate: "06.10.2026", invNo: "948/2026-27", basic: 48305, gstRate: 18, gstAmt: 8695, totalAmt: 57000, tdsRate: 0, tdsAmt: 0, payable: 57000, paid: 57000, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 34, vendor: "ASIAN HARDWARE STORES", site: "TATA KOPPAL", type: "Supply", invDate: "10.10.2026", invNo: "AH/26-27/753", basic: 45400, gstRate: 18, gstAmt: 8172, totalAmt: 53572, tdsRate: 0, tdsAmt: 0, payable: 53572, paid: 53572, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 35, vendor: "ASIAN HARDWARE STORES", site: "TATA KOPPAL", type: "Supply", invDate: "10.10.2026", invNo: "AH/26-27/754", basic: 87600, gstRate: 18, gstAmt: 15768, totalAmt: 103368, tdsRate: 0, tdsAmt: 0, payable: 103368, paid: 103368, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 36, vendor: "ASIAN HARDWARE STORES", site: "TATA KOPPAL", type: "Supply", invDate: "10.10.2026", invNo: "AH/26-27/755", basic: 17100, gstRate: 18, gstAmt: 3078, totalAmt: 20178, tdsRate: 0, tdsAmt: 0, payable: 20178, paid: 20178, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 37, vendor: "Fibre Crafts Continental Private Limited", site: "TATA KOPPAL", type: "Supply", invDate: "08.10.2026", invNo: "FCPL/26/2604", basic: 76000, gstRate: 18, gstAmt: 13680, totalAmt: 89680, tdsRate: 0, tdsAmt: 0, payable: 89680, paid: 89680, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 38, vendor: "Ramdev Hardware", site: "TATA KOPPAL", type: "Supply", invDate: "10.10.2026", invNo: "4225", basic: 22576, gstRate: 18, gstAmt: 4064, totalAmt: 26640, tdsRate: 0, tdsAmt: 0, payable: 26640, paid: 26624, bal: 16, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 39, vendor: "Ramdev Traders", site: "TATA KOPPAL", type: "Supply", invDate: "10.10.2026", invNo: "R/26-27/1439", basic: 151833, gstRate: 18, gstAmt: 27330, totalAmt: 179163, tdsRate: 0, tdsAmt: 0, payable: 179163, paid: 179163, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 40, vendor: "Super Crane Service", site: "HYD20 HYDERABAD", type: "Service", invDate: "", invNo: "ADV-HYD-CRANE", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 100000, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "Farana Advance Payment" },
  { sn: 41, vendor: "Anant Technologies", site: "ADANI WATER", type: "Supply", invDate: "05.10.2026", invNo: "0662/26-27", basic: 12126, gstRate: 18, gstAmt: 2183, totalAmt: 14309, tdsRate: 0, tdsAmt: 0, payable: 14309, paid: 14309, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 42, vendor: "Maharashtra Trading Company", site: "TATA KOPPAL", type: "Supply", invDate: "07.10.2026", invNo: "MTC/1566/26-27", basic: 26400, gstRate: 18, gstAmt: 4752, totalAmt: 31152, tdsRate: 0, tdsAmt: 0, payable: 31152, paid: 31152, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 43, vendor: "AP Machine Tools", site: "TATA ASSAM", type: "Supply", invDate: "11.10.2026", invNo: "913/2026-27", basic: 42500, gstRate: 18, gstAmt: 7650, totalAmt: 50150, tdsRate: 0, tdsAmt: 0, payable: 50150, paid: 50150, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 44, vendor: "GANESH TRADING COMPANY", site: "GTPL LUMINA", type: "Supply", invDate: "13.10.2026", invNo: "GTC/1784/26-27", basic: 5670, gstRate: 18, gstAmt: 722, totalAmt: 6392, tdsRate: 0, tdsAmt: 0, payable: 6392, paid: 6392, bal: 0, status: "Paid", payDate: "28.10.2026", remarks: "" },
  { sn: 45, vendor: "ASIAN HARDWARE STORES", site: "TATA PALAYAM", type: "Supply", invDate: "13.10.2026", invNo: "AH/26-27/764", basic: 13085, gstRate: 18, gstAmt: 2355, totalAmt: 15440, tdsRate: 0, tdsAmt: 0, payable: 15440, paid: 15204, bal: 236, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 46, vendor: "Prince Crane Service", site: "SIFY RABALE", type: "Service", invDate: "09.10.2026", invNo: "211/26-27", basic: 7000, gstRate: 18, gstAmt: 1260, totalAmt: 8260, tdsRate: 2, tdsAmt: 140, payable: 8120, paid: 0, bal: 8120, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 47, vendor: "ALAMDAR ENTERPRISE", site: "HYD20 HYDERABAD", type: "Supply", invDate: "12.10.2026", invNo: "284", basic: 30354, gstRate: 18, gstAmt: 5464, totalAmt: 35818, tdsRate: 0, tdsAmt: 0, payable: 35818, paid: 35818, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 48, vendor: "VOLTECH ENGINEERS PVT LTD", site: "ADANI WATER", type: "Service", invDate: "30.09.2026", invNo: "NV/DI053/26-27", basic: 225000, gstRate: 18, gstAmt: 40500, totalAmt: 265500, tdsRate: 10, tdsAmt: 22500, payable: 243000, paid: 0, bal: 243000, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 49, vendor: "HND Industries", site: "TATA KOPPAL", type: "Supply", invDate: "21.10.2026", invNo: "HnD/464/26-27", basic: 52600, gstRate: 18, gstAmt: 9468, totalAmt: 62068, tdsRate: 2, tdsAmt: 1052, payable: 61016, paid: 62068, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 50, vendor: "Sri Manjnatha Handling Service", site: "TATA KOPPAL", type: "Service", invDate: "18.10.2026", invNo: "380", basic: 250000, gstRate: 18, gstAmt: 45000, totalAmt: 295000, tdsRate: 2, tdsAmt: 5000, payable: 290000, paid: 0, bal: 290000, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 51, vendor: "RAJESHWAR SALES CORPORATION", site: "ADANI WATER", type: "Supply", invDate: "29.09.2026", invNo: "GST/26-27/1894", basic: 3970, gstRate: 18, gstAmt: 715, totalAmt: 4685, tdsRate: 0, tdsAmt: 0, payable: 4685, paid: 4685, bal: 0, status: "Paid", payDate: "05.11.2026", remarks: "" },
  { sn: 52, vendor: "RISHI ENVIROCARE", site: "HMCL DHARUHERA", type: "Supply", invDate: "20.06.2026", invNo: "REC/TI/26/39", basic: 17000, gstRate: 18, gstAmt: 3060, totalAmt: 20060, tdsRate: 0, tdsAmt: 0, payable: 20060, paid: 0, bal: 20060, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 53, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "09.09.2026", invNo: "SVH/26-27/983", basic: 3458, gstRate: 18, gstAmt: 622, totalAmt: 4080, tdsRate: 0, tdsAmt: 0, payable: 4080, paid: 4081, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 54, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "15.09.2026", invNo: "SVH/26-27/1025", basic: 22661, gstRate: 18, gstAmt: 4079, totalAmt: 26740, tdsRate: 0, tdsAmt: 0, payable: 26740, paid: 26740, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 55, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "26.09.2026", invNo: "SVH/26-27/1082", basic: 10495, gstRate: 18, gstAmt: 1864, totalAmt: 12359, tdsRate: 0, tdsAmt: 0, payable: 12359, paid: 520, bal: 11839, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 56, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "30.09.2026", invNo: "SVH/26-27/1110", basic: 15085, gstRate: 18, gstAmt: 2715, totalAmt: 17800, tdsRate: 0, tdsAmt: 0, payable: 17800, paid: 17800, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 57, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "08.10.2026", invNo: "SVH/26-27/1149", basic: 19492, gstRate: 18, gstAmt: 3509, totalAmt: 23000, tdsRate: 0, tdsAmt: 0, payable: 23000, paid: 0, bal: 23000, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 58, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "15.10.2026", invNo: "SVH/26-27/1188", basic: 37982, gstRate: 18, gstAmt: 6837, totalAmt: 44818, tdsRate: 0, tdsAmt: 0, payable: 44818, paid: 0, bal: 44818, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 59, vendor: "M/S SHREE VARDHAMAN HARDWARE", site: "TATA ASSAM", type: "Supply", invDate: "17.10.2026", invNo: "SVH/26-27/1205", basic: 729, gstRate: 18, gstAmt: 131, totalAmt: 860, tdsRate: 0, tdsAmt: 0, payable: 860, paid: 861, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 60, vendor: "Iberg Technologies and Engineers Pvt Ltd", site: "HMCL DHARUHERA", type: "Service", invDate: "24.10.2026", invNo: "MAT/2026-27/22", basic: 2228400, gstRate: 18, gstAmt: 401112, totalAmt: 2629512, tdsRate: 2, tdsAmt: 44568, payable: 2584944, paid: 220000, bal: 2364944, status: "Part Paid", payDate: "", remarks: "" },
  { sn: 61, vendor: "UNIPROMPT TECHNICAL SERVICES PVT LTD", site: "SIFY RABALE", type: "Service", invDate: "26.08.2026", invNo: "047UPNK2627", basic: 146000, gstRate: 18, gstAmt: 26280, totalAmt: 172280, tdsRate: 10, tdsAmt: 14600, payable: 157680, paid: 157680, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 62, vendor: "Hotel Hub", site: "Site not assigned", type: "Supply", invDate: "21.10.2026", invNo: "390/26-27", basic: 182000, gstRate: 18, gstAmt: 32760, totalAmt: 214760, tdsRate: 0, tdsAmt: 0, payable: 214760, paid: 214760, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 63, vendor: "ASIAN HARDWARE STORES", site: "TATA KOPPAL", type: "Supply", invDate: "19.10.2026", invNo: "AH/26-27/790", basic: 96896, gstRate: 18, gstAmt: 16137, totalAmt: 113033, tdsRate: 0, tdsAmt: 0, payable: 113033, paid: 113033, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 64, vendor: "ASIAN HARDWARE STORES", site: "TATA KOPPAL", type: "Supply", invDate: "19.10.2026", invNo: "AH/26-27/792", basic: 74000, gstRate: 18, gstAmt: 13320, totalAmt: 87320, tdsRate: 0, tdsAmt: 0, payable: 87320, paid: 87320, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 65, vendor: "ASIAN HARDWARE STORES", site: "GTPL LUMINA", type: "Supply", invDate: "27.10.2026", invNo: "AH/26-27/826", basic: 25220, gstRate: 18, gstAmt: 4082, totalAmt: 29302, tdsRate: 0, tdsAmt: 0, payable: 29302, paid: 29302, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 66, vendor: "Palak Engineering Works", site: "GTPL LUMINA", type: "Service", invDate: "08.10.2026", invNo: "45", basic: 16000, gstRate: 18, gstAmt: 2880, totalAmt: 18880, tdsRate: 0, tdsAmt: 0, payable: 18880, paid: 18880, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 67, vendor: "Darshan Safety Zone", site: "TATA KOPPAL", type: "Supply", invDate: "21.10.2026", invNo: "DSZ/2617/26-27", basic: 14400, gstRate: 18, gstAmt: 2592, totalAmt: 16992, tdsRate: 0, tdsAmt: 0, payable: 16992, paid: 16992, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 68, vendor: "Indesto Mech Engineering Service", site: "TATA PALAYAM", type: "Service", invDate: "26.10.2026", invNo: "IME/2026/653", basic: 8750, gstRate: 0, gstAmt: 0, totalAmt: 8750, tdsRate: 0, tdsAmt: 0, payable: 8750, paid: 0, bal: 8750, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 69, vendor: "Hilti India Pvt. Ltd", site: "TATA ASSAM", type: "Supply", invDate: "13.10.2026", invNo: "Quote: 1594031", basic: 153598, gstRate: 18, gstAmt: 27648, totalAmt: 181245, tdsRate: 0, tdsAmt: 0, payable: 181245, paid: 181246, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 70, vendor: "VC ENTERPRISES", site: "GTPL LUMINA", type: "Service", invDate: "06.10.2026", invNo: "VC/213/26-27", basic: 11000, gstRate: 18, gstAmt: 1980, totalAmt: 12980, tdsRate: 0, tdsAmt: 0, payable: 12980, paid: 0, bal: 12980, status: "Outstanding", payDate: "", remarks: "" },
  { sn: 71, vendor: "Msafe Equipments Limited", site: "TATA KOPPAL", type: "Service", invDate: "26.10.2026", invNo: "SALE\\BL2610\\2789", basic: 413636, gstRate: 18, gstAmt: 74454, totalAmt: 488090, tdsRate: 0, tdsAmt: 0, payable: 488090, paid: 488091, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 72, vendor: "ADORN SILVER ATELIER LLP", site: "Site not assigned", type: "Supply", invDate: "15.10.2026", invNo: "SB/2026-27/1106", basic: 26213, gstRate: 3, gstAmt: 786, totalAmt: 26999, tdsRate: 0, tdsAmt: 0, payable: 26999, paid: 27000, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 73, vendor: "SPK Power Infra Pvt Ltd", site: "TATA KOPPAL", type: "Service", invDate: "05.11.2026", invNo: "3413", basic: 37000, gstRate: 18, gstAmt: 6660, totalAmt: 43660, tdsRate: 0, tdsAmt: 0, payable: 43660, paid: 43660, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 74, vendor: "Bagaria Tools And Hardware", site: "TATA ASSAM", type: "Supply", invDate: "02.11.2026", invNo: "BTH/26/08214", basic: 17132, gstRate: 18, gstAmt: 3006, totalAmt: 20138, tdsRate: 0, tdsAmt: 0, payable: 20138, paid: 20138, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 75, vendor: "Bala Service", site: "TATA CGPL", type: "Service", invDate: "13.08.2026", invNo: "2026-27/171", basic: 20000, gstRate: 18, gstAmt: 3600, totalAmt: 23600, tdsRate: 0, tdsAmt: 0, payable: 23600, paid: 23600, bal: 0, status: "Paid", payDate: "30.10.2026", remarks: "" },
  { sn: 76, vendor: "KHATAWATE AGENCIES", site: "TATA KOPPAL", type: "Supply", invDate: "31.10.2026", invNo: "26938", basic: 8814, gstRate: 18, gstAmt: 1587, totalAmt: 10401, tdsRate: 0, tdsAmt: 0, payable: 10401, paid: 10401, bal: 0, status: "Paid", payDate: "31.10.2026", remarks: "" },
  { sn: 77, vendor: "Maharashtra Trading Company", site: "TATA KOPPAL", type: "Supply", invDate: "05.11.2026", invNo: "MTC/1806/26-27", basic: 63400, gstRate: 18, gstAmt: 11412, totalAmt: 74812, tdsRate: 0, tdsAmt: 0, payable: 74812, paid: 74812, bal: 0, status: "Paid", payDate: "", remarks: "" },
  { sn: 78, vendor: "Nissi Engineering Solution Private Limited", site: "HYD20 HYDERABAD", type: "Service", invDate: "02.11.2026", invNo: "PR/26-27/1085", basic: 51091, gstRate: 18, gstAmt: 9196, totalAmt: 60287, tdsRate: 10, tdsAmt: 5109, payable: 55178, paid: 60286, bal: 0, status: "Paid", payDate: "04.11.2026", remarks: "" },
  { sn: 79, vendor: "ARK Tools Private Limited", site: "TATA KOPPAL", type: "Supply", invDate: "", invNo: "ADV-KOPPAL-ARK", basic: 0, gstRate: 0, gstAmt: 0, totalAmt: 0, tdsRate: 0, tdsAmt: 0, payable: 0, paid: 500000, bal: 0, status: "Awaiting Invoice", payDate: "", remarks: "Material Advance Payment" }
];

async function importTracker() {
    try {
        console.log('🚀 Importing exact 79 rows from client Vendor Payment Tracker...');

        // Map sites
        const sRes = await db.query('SELECT site_id, site_name FROM sites');
        const siteMap = {};
        sRes.rows.forEach(r => siteMap[r.site_name] = r.site_id);

        // Map vendors & ensure all vendors exist
        const vendorNames = [...new Set(rawData.map(r => r.vendor))];
        const vendorMap = {};
        let vIdx = 100;
        for (const vName of vendorNames) {
            let vRes = await db.query('SELECT vendor_id, vendor_name FROM vendors WHERE vendor_name ILIKE $1', [vName]);
            if (vRes.rows.length === 0) {
                const code = 'VND-' + vName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + '-' + (vIdx++);
                vRes = await db.query(
                    'INSERT INTO vendors (vendor_code, vendor_name, category, compliance_status) VALUES ($1, $2, $3, $4) RETURNING vendor_id, vendor_name',
                    [code, vName, 'EQUIPMENT', 'COMPLIANT']
                );
            }
            vendorMap[vName] = vRes.rows[0].vendor_id;
        }

        // Truncate tables for fresh exact import
        await db.query('TRUNCATE TABLE vendor_payments CASCADE');
        await db.query('TRUNCATE TABLE vendor_invoices CASCADE');

        const parseDate = (dStr) => {
            if (!dStr) return null;
            const parts = dStr.trim().split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return dStr;
        };

        let insertedCount = 0;
        for (const r of rawData) {
            const siteName = r.site === 'OFFICE' ? 'Site not assigned' : r.site;
            const siteId = siteMap[siteName] || siteMap['Site not assigned'] || null;
            const vendorId = vendorMap[r.vendor] || null;
            const invDate = parseDate(r.invDate) || '2026-10-01';
            const payDate = parseDate(r.payDate) || invDate;

            let status = 'OUTSTANDING';
            if (r.status === 'Paid') status = 'PAID';
            else if (r.status === 'Part Paid') status = 'PART_PAID';
            else if (r.status === 'Outstanding') status = 'OUTSTANDING';
            else if (r.status === 'Awaiting Invoice') status = 'AWAITING_INVOICE';

            const insRes = await db.query(`
                INSERT INTO vendor_invoices (
                    vendor_id, site_id, vendor_name, site_name,
                    invoice_number, invoice_date, due_date, po_number,
                    category, basic_amount, gst_rate, gst_amount, tds_rate, tds_amount,
                    invoice_value, total_payable, paid_amount, outstanding_amount, status, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                RETURNING invoice_id
            `, [
                vendorId,
                siteId,
                r.vendor,
                siteName,
                r.invNo,
                invDate,
                null,
                `PO-${siteName.slice(0, 4)}-${String(r.sn).padStart(3, '0')}`,
                r.type || 'MATERIAL',
                r.basic,
                r.gstRate,
                r.gstAmt,
                r.tdsRate,
                r.tdsAmt,
                r.totalAmt,
                r.payable,
                r.paid,
                r.bal,
                status,
                r.remarks || null
            ]);

            const invoiceId = insRes.rows[0].invoice_id;
            insertedCount++;

            // Insert payment if paid > 0
            if (r.paid > 0) {
                const utr = `UTR${r.sn.toString().padStart(3, '0')}${Date.now().toString().slice(-4)}`;
                await db.query(`
                    INSERT INTO vendor_payments (
                        invoice_id, vendor_id, payment_date, amount_paid,
                        payment_mode, transaction_reference, bank_name, paid_by, remarks
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    invoiceId,
                    vendorId,
                    payDate,
                    r.paid,
                    'NEFT/RTGS',
                    utr,
                    'HDFC Bank',
                    'Finance Dept',
                    r.remarks ? `Settlement: ${r.remarks.slice(0, 80)}` : 'Bank Transfer Settlement'
                ]);
            }
        }

        console.log(`✅ Successfully imported all ${insertedCount} exact invoices!`);

        // Check KPI totals
        const kpi = await db.query(`
            SELECT
                COUNT(*)::int AS total_items,
                SUM(basic_amount)::numeric(14,2) AS sum_basic,
                SUM(gst_amount)::numeric(14,2) AS sum_gst,
                SUM(tds_amount)::numeric(14,2) AS sum_tds,
                SUM(total_payable)::numeric(14,2) AS sum_payable,
                SUM(paid_amount)::numeric(14,2) AS sum_paid,
                SUM(outstanding_amount)::numeric(14,2) AS sum_outstanding,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int AS paid_inv_count,
                COUNT(CASE WHEN status = 'PART_PAID' THEN 1 END)::int AS part_paid_count,
                COUNT(CASE WHEN status = 'OUTSTANDING' THEN 1 END)::int AS outstanding_count,
                COUNT(CASE WHEN status = 'AWAITING_INVOICE' THEN 1 END)::int AS awaiting_count
            FROM vendor_invoices
        `);
        console.log('\n================ EXACT MASTER KPIS ================');
        console.log(kpi.rows[0]);

        const statusBreakdown = await db.query(`
            SELECT status, COUNT(*)::int AS count, SUM(total_payable)::numeric(14,2) AS payable, SUM(paid_amount)::numeric(14,2) AS paid, SUM(outstanding_amount)::numeric(14,2) AS outst
            FROM vendor_invoices
            GROUP BY status
            ORDER BY status
        `);
        console.log('\n================ STATUS BREAKDOWN ================');
        console.table(statusBreakdown.rows);

        process.exit(0);
    } catch(err) {
        console.error('Import error:', err);
        process.exit(1);
    }
}

importTracker();
