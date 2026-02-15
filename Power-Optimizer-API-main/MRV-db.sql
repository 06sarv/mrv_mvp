--
-- PostgreSQL database dump
--

\restrict empdS0qV8wcaKHw70ESqmV4VulFa3NJ06RHkYe4ZqRjc30hLMwPSvT4c3l7VLRn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2026-02-10 21:33:16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 16428)
-- Name: mrv; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA mrv;


ALTER SCHEMA mrv OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 225 (class 1259 OID 16472)
-- Name: appliance_state; Type: TABLE; Schema: mrv; Owner: postgres
--

CREATE TABLE mrv.appliance_state (
    state_id integer NOT NULL,
    appliance_id integer,
    status text,
    level integer,
    estimated_power_watts integer,
    source text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appliance_state_status_check CHECK ((status = ANY (ARRAY['ON'::text, 'OFF'::text])))
);


ALTER TABLE mrv.appliance_state OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16471)
-- Name: appliance_state_state_id_seq; Type: SEQUENCE; Schema: mrv; Owner: postgres
--

CREATE SEQUENCE mrv.appliance_state_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE mrv.appliance_state_state_id_seq OWNER TO postgres;

--
-- TOC entry 4938 (class 0 OID 0)
-- Dependencies: 224
-- Name: appliance_state_state_id_seq; Type: SEQUENCE OWNED BY; Schema: mrv; Owner: postgres
--

ALTER SEQUENCE mrv.appliance_state_state_id_seq OWNED BY mrv.appliance_state.state_id;


--
-- TOC entry 223 (class 1259 OID 16455)
-- Name: appliances; Type: TABLE; Schema: mrv; Owner: postgres
--

CREATE TABLE mrv.appliances (
    appliance_id integer NOT NULL,
    room_id integer,
    appliance_type text NOT NULL,
    name text,
    max_power_watts integer NOT NULL,
    adjustable boolean DEFAULT true,
    number_of_appliances integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE mrv.appliances OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16454)
-- Name: appliances_appliance_id_seq; Type: SEQUENCE; Schema: mrv; Owner: postgres
--

CREATE SEQUENCE mrv.appliances_appliance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE mrv.appliances_appliance_id_seq OWNER TO postgres;

--
-- TOC entry 4939 (class 0 OID 0)
-- Dependencies: 222
-- Name: appliances_appliance_id_seq; Type: SEQUENCE OWNED BY; Schema: mrv; Owner: postgres
--

ALTER SEQUENCE mrv.appliances_appliance_id_seq OWNED BY mrv.appliances.appliance_id;


--
-- TOC entry 221 (class 1259 OID 16440)
-- Name: occupancy; Type: TABLE; Schema: mrv; Owner: postgres
--

CREATE TABLE mrv.occupancy (
    occupancy_id integer NOT NULL,
    room_id integer,
    people_count integer NOT NULL,
    detected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    confidence real,
    source text
);


ALTER TABLE mrv.occupancy OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16439)
-- Name: occupancy_occupancy_id_seq; Type: SEQUENCE; Schema: mrv; Owner: postgres
--

CREATE SEQUENCE mrv.occupancy_occupancy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE mrv.occupancy_occupancy_id_seq OWNER TO postgres;

--
-- TOC entry 4940 (class 0 OID 0)
-- Dependencies: 220
-- Name: occupancy_occupancy_id_seq; Type: SEQUENCE OWNED BY; Schema: mrv; Owner: postgres
--

ALTER SEQUENCE mrv.occupancy_occupancy_id_seq OWNED BY mrv.occupancy.occupancy_id;


--
-- TOC entry 219 (class 1259 OID 16430)
-- Name: rooms; Type: TABLE; Schema: mrv; Owner: postgres
--

CREATE TABLE mrv.rooms (
    room_id integer NOT NULL,
    room_name text NOT NULL,
    max_capacity integer NOT NULL,
    floor integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE mrv.rooms OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16429)
-- Name: rooms_room_id_seq; Type: SEQUENCE; Schema: mrv; Owner: postgres
--

CREATE SEQUENCE mrv.rooms_room_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE mrv.rooms_room_id_seq OWNER TO postgres;

--
-- TOC entry 4941 (class 0 OID 0)
-- Dependencies: 218
-- Name: rooms_room_id_seq; Type: SEQUENCE OWNED BY; Schema: mrv; Owner: postgres
--

ALTER SEQUENCE mrv.rooms_room_id_seq OWNED BY mrv.rooms.room_id;


--
-- TOC entry 4766 (class 2604 OID 16475)
-- Name: appliance_state state_id; Type: DEFAULT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliance_state ALTER COLUMN state_id SET DEFAULT nextval('mrv.appliance_state_state_id_seq'::regclass);


--
-- TOC entry 4762 (class 2604 OID 16458)
-- Name: appliances appliance_id; Type: DEFAULT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliances ALTER COLUMN appliance_id SET DEFAULT nextval('mrv.appliances_appliance_id_seq'::regclass);


--
-- TOC entry 4760 (class 2604 OID 16443)
-- Name: occupancy occupancy_id; Type: DEFAULT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.occupancy ALTER COLUMN occupancy_id SET DEFAULT nextval('mrv.occupancy_occupancy_id_seq'::regclass);


--
-- TOC entry 4758 (class 2604 OID 16433)
-- Name: rooms room_id; Type: DEFAULT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.rooms ALTER COLUMN room_id SET DEFAULT nextval('mrv.rooms_room_id_seq'::regclass);


--
-- TOC entry 4932 (class 0 OID 16472)
-- Dependencies: 225
-- Data for Name: appliance_state; Type: TABLE DATA; Schema: mrv; Owner: postgres
--

COPY mrv.appliance_state (state_id, appliance_id, status, level, estimated_power_watts, source, updated_at) FROM stdin;
1	1	ON	6	2400	rule-engine	2026-02-10 21:25:13.821107
2	2	ON	3	225	rule-engine	2026-02-10 21:25:13.821107
3	3	ON	1	240	rule-engine	2026-02-10 21:25:13.821107
\.


--
-- TOC entry 4930 (class 0 OID 16455)
-- Dependencies: 223
-- Data for Name: appliances; Type: TABLE DATA; Schema: mrv; Owner: postgres
--

COPY mrv.appliances (appliance_id, room_id, appliance_type, name, max_power_watts, adjustable, number_of_appliances, created_at) FROM stdin;
1	1	AC	Daikin AC	2000	t	2	2026-02-10 21:24:59.359674
2	1	FAN	Ceiling Fan	75	t	4	2026-02-10 21:24:59.359674
3	1	LIGHT	LED Light	40	f	6	2026-02-10 21:24:59.359674
\.


--
-- TOC entry 4928 (class 0 OID 16440)
-- Dependencies: 221
-- Data for Name: occupancy; Type: TABLE DATA; Schema: mrv; Owner: postgres
--

COPY mrv.occupancy (occupancy_id, room_id, people_count, detected_at, confidence, source) FROM stdin;
1	1	5	2026-02-10 21:25:05.424335	0.92	camera
\.


--
-- TOC entry 4926 (class 0 OID 16430)
-- Dependencies: 219
-- Data for Name: rooms; Type: TABLE DATA; Schema: mrv; Owner: postgres
--

COPY mrv.rooms (room_id, room_name, max_capacity, floor, created_at) FROM stdin;
1	Conference Room A	20	2	2026-02-10 21:24:51.955605
\.


--
-- TOC entry 4942 (class 0 OID 0)
-- Dependencies: 224
-- Name: appliance_state_state_id_seq; Type: SEQUENCE SET; Schema: mrv; Owner: postgres
--

SELECT pg_catalog.setval('mrv.appliance_state_state_id_seq', 3, true);


--
-- TOC entry 4943 (class 0 OID 0)
-- Dependencies: 222
-- Name: appliances_appliance_id_seq; Type: SEQUENCE SET; Schema: mrv; Owner: postgres
--

SELECT pg_catalog.setval('mrv.appliances_appliance_id_seq', 3, true);


--
-- TOC entry 4944 (class 0 OID 0)
-- Dependencies: 220
-- Name: occupancy_occupancy_id_seq; Type: SEQUENCE SET; Schema: mrv; Owner: postgres
--

SELECT pg_catalog.setval('mrv.occupancy_occupancy_id_seq', 1, true);


--
-- TOC entry 4945 (class 0 OID 0)
-- Dependencies: 218
-- Name: rooms_room_id_seq; Type: SEQUENCE SET; Schema: mrv; Owner: postgres
--

SELECT pg_catalog.setval('mrv.rooms_room_id_seq', 1, true);


--
-- TOC entry 4776 (class 2606 OID 16481)
-- Name: appliance_state appliance_state_pkey; Type: CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliance_state
    ADD CONSTRAINT appliance_state_pkey PRIMARY KEY (state_id);


--
-- TOC entry 4774 (class 2606 OID 16465)
-- Name: appliances appliances_pkey; Type: CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliances
    ADD CONSTRAINT appliances_pkey PRIMARY KEY (appliance_id);


--
-- TOC entry 4772 (class 2606 OID 16448)
-- Name: occupancy occupancy_pkey; Type: CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.occupancy
    ADD CONSTRAINT occupancy_pkey PRIMARY KEY (occupancy_id);


--
-- TOC entry 4770 (class 2606 OID 16438)
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (room_id);


--
-- TOC entry 4779 (class 2606 OID 16482)
-- Name: appliance_state appliance_state_appliance_id_fkey; Type: FK CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliance_state
    ADD CONSTRAINT appliance_state_appliance_id_fkey FOREIGN KEY (appliance_id) REFERENCES mrv.appliances(appliance_id) ON DELETE CASCADE;


--
-- TOC entry 4778 (class 2606 OID 16466)
-- Name: appliances appliances_room_id_fkey; Type: FK CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.appliances
    ADD CONSTRAINT appliances_room_id_fkey FOREIGN KEY (room_id) REFERENCES mrv.rooms(room_id) ON DELETE CASCADE;


--
-- TOC entry 4777 (class 2606 OID 16449)
-- Name: occupancy occupancy_room_id_fkey; Type: FK CONSTRAINT; Schema: mrv; Owner: postgres
--

ALTER TABLE ONLY mrv.occupancy
    ADD CONSTRAINT occupancy_room_id_fkey FOREIGN KEY (room_id) REFERENCES mrv.rooms(room_id) ON DELETE CASCADE;


-- Completed on 2026-02-10 21:33:16

--
-- PostgreSQL database dump complete
--

\unrestrict empdS0qV8wcaKHw70ESqmV4VulFa3NJ06RHkYe4ZqRjc30hLMwPSvT4c3l7VLRn

