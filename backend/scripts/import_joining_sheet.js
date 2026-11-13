const db = require('../config/database');

const rawData = `SL.NO	NAME OF EMPLOYEES	FATHER NAME	ADHAR NO	BANK A/C NO	IFSC CODE	UAN NO	PAN CARD NO	MOBILE NO	DATE OF JOINING	PHOTO	Remarks			
1	Deepak Kumar	Lal Babu Yadav	549142412508	181510100061220	UBIN0549860	102384893339	MULPK3816P	 9630214314	04.09.2026		Already Registration Done			
2	Pintu	Kanhaiya Lal	421125605215	,31913312822	SBIN0002616	102332015116	CPCPP6426A	7607159298	01.08.2026		Already Registration Done			
3	Biplab Mondal	Biswanath Mondal	203801849034	,22160100023682	BARB0GAURIP	101253683212	ETHPM8593L	6295485960	09.09.2026		Already Registration Done			
4	Golu Sahani	Mukurdhwj Sahani	387975846075	,25108100025192	BARB0BALLUX	102388034048	102388034048	7463850572	01.09.2026		Already Registration Done			
5	Prem Shankar Sahani	Achchelal Sahani	297702879172	,353722010003063	UBIN0935379	102028511832	HYJPP3917F	9506736151	06.09.2026		Already Registration Done			
6	Vijay Kumar Suyawanshi	Dhansay Suryawanshi	296104648942	,36129659406	SBIN0000395	101553228409	MSPPS8134Q	843589724	12.09.2026		Already Registration Done			
7	Md Rahmatullah Quraishi	Md Kamre Alam Quraishi	421286267263	44385625063	SBIN0002931	102389582101	ABCPQ8603Q	8969361100	01.09.2026		Already Registration Done			
8	Lokesh Kumar	Kshetrpal Singh	237392953309	,42673980309	SBIN0011632	102263744316	OFVPK4084Q	9536007289	07.09.2026		Already Registration Done			
9	Arman Alam	Jainudin Ansari	713191710376	,182001517360	ICIC0001820	101591727222	DBVPA4660M	8507690023	01.09.2026		Already Registration Done			
10	Kalanithi K	Karunanithi	214043636475	,32575722956	SBIN0000807	101858634680	EPQPK6192L	7639609491	21.09.2026		Already Registration Done			
11	Samir Raza	Abdul Gafoor	358056871533	925010008015931	UTIB0000446	102196844691	FRQPR8238R	9225356746	23.09.2026		Already Registration Done			
12	Mahesh Boro	Karan Boro	234241453735	31883646888	SBIN0002068	102163240086	BDUPB6221Q	6362461386	23.09.2026		Already Registration Done			
13	Imran Khan	Babu Khan	228753638794	27518100010784	BARB0SIRGAN	101601890913	DCZPK9081D	9381299875	14.09.2026		Already Registration Done			
14	Devendra Kumar	Shiv Prasad	445655994489	923010045917977	UTIB0001525	102392381613	LXUPK0868C	7704032835	21.09.2026		Already Registration Done			
15	Ravi Pratap	Sugriv Prasad	820194926849	2080000100704820	PUNB0208000	101176556136	ENWPP3249H	7877944348	21.09.2026		Already Registration Done			
16	Shalu Kumari	Gaurav Bharti	716262198040	,5010 0905 8767 80 	HDFC0003112 	102396829417	GBRPK7360D	8126966227	01.09.2026		Already Registration Done			
17	Vandini Mangla	Amit Mangla	955116546933	,0885104000128582	IBKL0000885	102395852614	GWLPM5891J	9599422701	22.09.2026		Already Registration Done			
18	Shivam	Ram Prasad	383040134657	50100772663162	HDFC0000656	102196105889	RRQPS8997J	9990385942	24.09.2026		Already Registration Done			
19	Motiur Rehman	Idrish Ansari	263998780504	,37942423738	SBIN0001219	102219287222	The employee does not have a PAN Card.	7256918605	01.10.2026		Already Registration Done			
20	Tajim Parvez	Jainuddin Miyan	266449894779	,4002720675	CBIN0282426	101649969364	FQVPP4585H	9060354033	01.10.2026		Already Registration Done			
21	Tausif Ansari	Shamim Miyan	236070025781	,9950001700108549	PUNB0995000	102145441075	FLYPA9725G	6201169011	01.10.2026		Already Registration Done			
22	Dharmendra Kumar	Baijnath Sah	389344655983	,4109033615	CBIN0282743	102366337816	RQRPK5618A	8757710353	01.10.2026		Already Registration Done			
23	Arshad Ali	Izhar Ansari	536198048332	,921010055071607	UTIB0000004	101779418469	EHKPA9840R	7070407393	01.10.2026		Already Registration Done			
24	Munna Kumar	Girija Sav	870561389877	,4051000100195491	PUNB0405100	101915956513	HMCPK2465N	97710 60708	07.10.2026		Already Registration Done			
25	S Imran	Shaik Madar	911021302414	,433601502338	ICIC0004336	101394615459	ADBPI4645K	9600605774	01.10.2026		Already Registration Done			
26	Arunjyoti Doloi	Jaduram Doloi	697713197507	43869521084	SBIN0011616	102226768229	EKKPD4858R	9864876640	09.10.2026		Already Registration Done			
27	Bimal Barman	Suklal Barman	977531680835	29573211022213	UCBA0002957	102244620369	CRFPB3419Q	8811977676	09.10.2026		Already Registration Done			
28	Deepjyoti Konwar	Babul Konawar	806446083089	110188926920	CNRB0003951	101642051156	KDRPK1821D	6003576774	09.10.2026		Already Registration Done			
29	Prabin Deka	Pravat Deka	778499093588	42440239273	SBIN0062217	101890923947	HDWPD1666P	6000429602	09.10.2026		Already Registration Done			
30	Tauhid Alam	Shamim Ansari	809800231426	9950001700400605	PUNB0995000	102355172963	GQPPA9113K	7091233279	03.10.2026		Already Registration Done			
31	Azullah Ansari	Arif Ansari	416981611190	7212001700076680	PUNB0721200	101372461999	DMWPA4158J	6203970029	03.10.2026		Already Registration Done			
32	Utpal Bora	Nipen Bora	756102449597	7013708327	IDIB000P215	101647982597	AMRPU1791M	9964325238	09.10.2026		Already Registration Done			
33	Sekh Majharul	Sekh Majhlum	302664936911	42475726303	SBIN0015278	102402122499	IVEPM3185B	6295938044	05.10.2026		Already Registration Done			
34	SK Sabirul	SK Tahir	891524509477	35538128078	SBIN0018681	101424671010	FKIPS5018D	9547866850	05.10.2026		Already Registration Done			
35	Faiam Khan	Rustam Khan	579437339252	43670570670	SBIN0015278	102402087768	OTCPK3630P	9749834135	05.10.2026		Already Registration Done			
36	Sekh Asgar Ali	SK Robbani	313564197180	39099448711	SBIN0015278	102402103806	FWZPA5860G	7866901247	05.10.2026		Already Registration Done			
37	Rakiul SK	Sattar SK	659971756498	11463211197119	UCBA0001146	102401972887	SRMPS5374G	8144225585	05.10.2026		Already Registration Done			
38	SK Rafikul	SK Shuku	833609197657	876201700044793	PUNB0087620	102402082452	FWXPR0994G	8287448332	05.10.2026		Already Registration Done			
39	SK Ejajul	SK Sukumuddin	294857702464	44316594078	SBIN0006664	102402116426	AFVPE9136P	8653440043	05.10.2026		Already Registration Done			
40	Sekh Reajul	Khabir Sekh	676884362332	40078178860	SBIN0006664	101166300914	EPDPR4894R	7797937333	05.10.2026		Already Registration Done			
41	Mirajuddin SK	Seraj Sekh	290806095913	5759276185	CBIN0282141	102099497906	TYRPS8593G	9002872329	17.10.2026		Already Registration Done			
42	Samiul Sekh	Chhedu Sekh	416445237217	4011661197	CBIN0282141	102021239678	SIUPS3939A	8653852256	17.10.2026		Already Registration Done			
43	ED Mobarak SK	Nasim SK	676513439350	3903312221	CBIN0282141	102126611709	SXLPS1161L	7585830089	17.10.2026		Already Registration Done			
44	SK Sadikul	SK Sattar	310757028801	100230997665	INDB0000278	102407639867	OVCPS6341M	8088401817	15.10.2026		Already Registration Done			
45	Nur Alam Nadap	Sabed Nadap	267214946316	2995111465	CBIN0282140	102407631587	AYSPN7825L	7407419562	15.10.2026		Already Registration Done			
46	Sekh Lajim	Sekh Jahur	921865267893	876201700048382	PUNB0087620	101966082787	BLGPL7016P	8509769115	15.10.2026		Already Registration Done			
47	Mirja Rohan	Mirja Ramjan	314699555325	11463211028949	UCBA0001146	102407645990	HGUPR2184B	829360950	15.10.2026		Already Registration Done			
48	Bulu SK	Bechon SK	867741603513	33663288002	SBIN0015278	101778526651	USTPS1362C	9654804751	15.10.2026		Already Registration Done			
49	Nabirul	Sekh Samsuddin	976648025579	36719708580	SBIN0015278	102036707432	BBAPN7153F	9679038558	15.10.2026		Already Registration Done			
50	Sekh Sohel	Sekh Baksu	802497612436	44729273848	SBIN0015278	102407643731	UKFPS8382N	8293236994	12.10.2026		Already Registration Done			
51	Sakil SK	Saher SK	952160005096	64510111303	IPOS0000001	102407650784	PQMPS8976Q	8695296795	15.10.2026		Already Registration Done			
52	Bablu Yadav	Badri Yadav	883760066006	,45498104361	SBIN0002969	102412139039	CAZPY9175K	9335648089	13.10.2026					
53	Samir Ansari	Sabir Ansari	554884088173	9950001700239450	PUNB0995000	102344939215	GMDPA3581F	9905860104	31.10.2026					
54	Jalal Shekh	Reyaz Shekh	636872719772	38533518152	SBIN0002942	101491721668	KBFPS2826L	8459449377	31.10.2026					
55	Jabed Ansari	Amjad Miya	968935909598	8252493174	AIRP0000001	101789846239	EZLPA2154R	8252493174	31.10.2026					
56	Tahuid Alam	Shamim Ansari	809800231426	9950001700400605	PUNB0995000	102355172963	GQPPA9113K	7091233279	31.10.2026					
57	Ravindra Kumar	Amirlal Mahot	420908328955	50293899065	IDIB000R654	102039575460	JAZPK3703G	9875501159	15.10.2026					
58	Manirul Islam	Khalek Seikh	234026539601	43255962219	SBIN0002058	101771379065	ACXPI3675C	6295819774	22.10.2026					
59	Senthil  Elayaperumal	 Elayaperumal	701111354933	544001765	IDIB000S067	102382064007	The employee does not have a PAN Card.	918929536243	01.10.2026					
60	Sahul Kumar Deva Sagayaraj	Dava Sagayaraj	838050190180	100050096728	ESFB0001058	101174361820	The employee does not have a PAN Card.	919677768047	01.10.2026					
61	Sugumar Vijay	Vijay	252311961137	40345395747	SBIN0000985	102263347306	The employee does not have a PAN Card.	918148294587	01.10.2026					
62	Rakiul 	SK Anesh	549034009282	35234134451	SBIN0018681	101335741684	BGTPR5222F	7585938379	27.10.2026					
63	Narinder Kumar	Purshotam Dass	2218 8965 4631	,1025 0100 0563	ICIC0001025	102413657391	BASPK5685A	87508 60160	01.10.2026`;

const getBankName = (ifsc) => {
    if (!ifsc) return 'Bank';
    const prefix = ifsc.slice(0, 4).toUpperCase();
    const map = {
        'SBIN': 'State Bank of India',
        'UBIN': 'Union Bank of India',
        'BARB': 'Bank of Baroda',
        'ICIC': 'ICICI Bank',
        'UTIB': 'Axis Bank',
        'PUNB': 'Punjab National Bank',
        'HDFC': 'HDFC Bank',
        'CBIN': 'Central Bank of India',
        'IDIB': 'Indian Bank',
        'CNRB': 'Canara Bank',
        'UCBA': 'UCO Bank',
        'INDB': 'IndusInd Bank',
        'IPOS': 'India Post Payments Bank',
        'ESFB': 'Equitas Small Finance Bank',
        'AIRP': 'Airtel Payments Bank',
        'IBKL': 'IDBI Bank'
    };
    return map[prefix] || `${prefix} Bank`;
};

(async () => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const lines = rawData.trim().split('\n');
        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split('\t').map(s => (s || '').trim());
            if (!parts[1]) continue;

            const slNo = parts[0];
            const fullName = parts[1];
            const fatherName = parts[2];
            const aadhaar = (parts[3] || '').replace(/\s+/g, '');
            const bankAccount = (parts[4] || '').replace(/^[,\s]+/, '').replace(/\s+/g, '');
            const ifsc = (parts[5] || '').replace(/\s+/g, '').toUpperCase();
            const uan = (parts[6] || '').replace(/\s+/g, '');
            const panRaw = parts[7] || '';
            const pan = /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panRaw.trim()) ? panRaw.trim().toUpperCase() : null;
            const mobileRaw = (parts[8] || '').replace(/[^\d]/g, '');
            const mobile = mobileRaw.slice(-10);

            let doj = null;
            const dateParts = (parts[9] || '').split('.');
            if (dateParts.length === 3) {
                doj = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }

            const remarks = parts[11] || '';

            // Check if already exists by Aadhaar or (Name + Father Name)
            const checkQuery = `
                SELECT employee_id, employee_code, full_name 
                FROM employees 
                WHERE (aadhaar_number = $1 AND $1 != '') 
                   OR (LOWER(full_name) = LOWER($2) AND LOWER(father_name) = LOWER($3))
            `;
            const checkRes = await client.query(checkQuery, [aadhaar, fullName, fatherName]);

            if (checkRes.rows.length > 0) {
                console.log(`Skipping row ${slNo} (${fullName}) - already exists as ${checkRes.rows[0].employee_code}`);
                skippedCount++;
                continue;
            }

            // Split name into first and last
            const nameTokens = fullName.split(' ').filter(Boolean);
            const firstName = nameTokens[0] || fullName;
            const lastName = nameTokens.slice(1).join(' ') || '';

            // Generate employee code using sequence
            const seqRes = await client.query("SELECT nextval('employee_code_seq') AS next_val");
            const nextVal = seqRes.rows[0].next_val;
            const empCode = `EMP-${String(nextVal).padStart(6, '0')}`;

            const bankName = getBankName(ifsc);

            const insertQuery = `
                INSERT INTO employees (
                    employee_code, first_name, last_name, full_name, father_name,
                    aadhaar_number, account_number, ifsc_code, bank_name,
                    uan_number, pan_number, mobile, date_of_joining, remarks,
                    designation, department, site_id, employment_status, is_active,
                    pf_applicable, esi_applicable, pt_applicable, wage_type, employment_type,
                    basic_salary, role_id
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19,
                    $20, $21, $22, $23, $24,
                    $25, $26
                ) RETURNING employee_id, employee_code, full_name
            `;

            const res = await client.query(insertQuery, [
                empCode,
                firstName,
                lastName || null,
                fullName,
                fatherName || null,
                aadhaar || null,
                bankAccount || null,
                ifsc || null,
                bankName,
                uan || null,
                pan || null,
                mobile || null,
                doj || null,
                remarks || (panRaw.includes('does not have') ? panRaw : null),
                'Technician / Site Worker',
                'Operations',
                4, // Default active site (Noida / General operations)
                'ACTIVE',
                true,
                true,
                true,
                true,
                'DAILY',
                'CONTRACT',
                26010, // Standard monthly base equivalent to 867 daily wage
                5      // EMPLOYEE role
            ]);

            importedCount++;
            console.log(`[${slNo}/63] Imported: ${res.rows[0].employee_code} - ${res.rows[0].full_name}`);
        }

        await client.query('COMMIT');
        console.log(`\n🎉 IMPORT COMPLETED! Successfully imported: ${importedCount}, Skipped: ${skippedCount}`);
        process.exit(0);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Import failed! Rolled back transaction:', e);
        process.exit(1);
    } finally {
        client.release();
    }
})();
