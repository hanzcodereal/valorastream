import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Heart,
  Home,
  Layers3,
  Library,
  LoaderCircle,
  Menu,
  MonitorPlay,
  Play,
  RefreshCw,
  Search,
  Star,
  Tv,
  X,
} from "lucide-react";
import { cleanTitle, getApi } from "./api";
import { go } from "./navigation";

type ContentType = "anime" | "donghua" | "comic";
type TargetType = "detail" | "watch" | "read";

type MediaItem = {
  id: string;
  type: ContentType;
  title: string;
  image: string;
  slug: string;
  meta?: string;
  score?: string;
  target?: TargetType;
};

type FavoriteItem = MediaItem & { savedAt: number };

type RouteInfo = {
  page: string;
  segments: string[];
  query: URLSearchParams;
  key: string;
};

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

const TYPE_LABELS: Record<ContentType, string> = {
  anime: "Anime",
  donghua: "Donghua",
  comic: "Comic",
};

const FALLBACK_POSTER =
  "https://otakudesu.blog/wp-content/uploads/2026/01/152472.jpg";

function parseRoute(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, "") || "home";
  const [path, queryString = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  return {
    page: segments[0] || "home",
    segments,
    query: new URLSearchParams(queryString),
    key: raw,
  };
}

function useRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function useRemote<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: Boolean(path),
    error: "",
  });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    getApi<T>(path, controller.signal)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Gagal memuat data";
        setState({ data: null, loading: false, error: message });
      });
    return () => controller.abort();
  }, [path]);

  return state;
}

function normalizeAnime(item: Record<string, unknown>): MediaItem {
  return {
    id: `anime:${String(item.animeId || item.slug || item.title)}`,
    type: "anime",
    title: cleanTitle(String(item.title || "Tanpa judul")),
    image: String(item.poster || FALLBACK_POSTER),
    slug: String(item.animeId || item.slug || ""),
    meta: item.releaseDay
      ? `${String(item.releaseDay)} - Episode ${String(item.episodes || "baru")}`
      : item.episodes
        ? `${String(item.episodes)} episode`
        : String(item.status || item.season || "Anime"),
    score: item.score ? String(item.score) : undefined,
  };
}

function normalizeDonghua(item: Record<string, unknown>): MediaItem {
  const rawTitle = String(item.title || "Tanpa judul");
  const slug = String(item.slug || "");
  const looksLikeEpisode = /episode-\d+/i.test(slug);
  return {
    id: `donghua:${slug || rawTitle}`,
    type: "donghua",
    title: cleanTitle(rawTitle),
    image: String(item.poster || item.thumbnail || FALLBACK_POSTER),
    slug,
    meta: String(item.type || (item.episode ? `Episode ${String(item.episode)}` : "Donghua")),
    target: looksLikeEpisode ? "watch" : "detail",
  };
}

function normalizeComic(item: Record<string, unknown>): MediaItem {
  const chapters = Array.isArray(item.chapters) ? item.chapters : [];
  const latest = chapters[0] as Record<string, unknown> | undefined;
  return {
    id: `comic:${String(item.slug || item.title)}`,
    type: "comic",
    title: cleanTitle(String(item.title || "Tanpa judul")),
    image: String(item.image || item.poster || FALLBACK_POSTER),
    slug: String(item.slug || ""),
    meta: latest?.title ? String(latest.title) : String(item.type || "Comic"),
    score: item.rating ? String(item.rating) : undefined,
  };
}

function itemPath(item: MediaItem): string {
  if (item.target === "read") return `read/${encodeURIComponent(item.slug)}`;
  if (item.target === "watch") return `watch/${item.type}/${encodeURIComponent(item.slug)}`;
  return `detail/${item.type}/${encodeURIComponent(item.slug)}`;
}

function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("valorastream:favorites") || "[]") as FavoriteItem[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("valorastream:favorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggle = (item: MediaItem) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => favorite.id === item.id);
      if (exists) return current.filter((favorite) => favorite.id !== item.id);
      return [{ ...item, savedAt: Date.now() }, ...current];
    });
  };

  return { favorites, toggle };
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <button
      className={`logo ${inverse ? "logo-inverse" : ""}`}
      onClick={() => go("home")}
      aria-label="Kembali ke beranda ValoraStream"
    >
      <span className="logo-mark"><Play size={15} fill="currentColor" /></span>
      <span>Valora<span>Stream</span></span>
    </button>
  );
}

const libraryNavItems = [
  { label: "Anime", icon: Tv, path: "library?type=anime&filter=ongoing" },
  { label: "Donghua", icon: MonitorPlay, path: "library?type=donghua&filter=latest" },
  { label: "Comic", icon: BookOpen, path: "library?type=comic&filter=latest" },
  { label: "Favorit", icon: Heart, path: "favorite" },
];

function LibraryNavMenu({ inverse }: { inverse: boolean }) {
  const [open, setOpen] = useState(false);
  const route = useRoute();

  useEffect(() => setOpen(false), [route.key]);

  return (
    <div
      className={`library-nav ${inverse ? "library-nav-inverse" : ""}`}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`library-nav-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        onMouseEnter={() => setOpen(true)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Library <ChevronDown size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="library-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            role="menu"
          >
            {libraryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} role="menuitem" onClick={() => go(item.path)}>
                  <Icon size={17} /> {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ homePage }: { homePage: boolean }) {
  return (
    <header className={`site-header ${homePage ? "site-header-hero" : ""}`}>
      <div className="header-inner">
        <Logo inverse={homePage} />
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <button onClick={() => go("home")}>Home</button>
          <LibraryNavMenu inverse={homePage} />
          <button onClick={() => go("schedule?type=anime")}>Jadwal</button>
          <button onClick={() => go("favorite")}>Favorite</button>
        </nav>
        <div className="header-actions">
          <button className={`header-search ${homePage ? "header-search-inverse" : ""}`} onClick={() => go("search?type=anime")} aria-label="Buka pencarian"><Search size={19} /><span>Cari</span></button>
        </div>
      </div>
    </header>
  );
}

const bottomItems = [
  { page: "home", label: "Home", icon: Home, path: "home" },
  { page: "library", label: "Library", icon: Library, path: "library?type=anime&filter=ongoing" },
  { page: "favorite", label: "Favorite", icon: Heart, path: "favorite", special: true },
  { page: "schedule", label: "Jadwal", icon: CalendarDays, path: "schedule?type=anime" },
  { page: "search", label: "Search", icon: Search, path: "search?type=anime" },
];

function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi mobile">
      {bottomItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.page;
        return (
          <button
            key={item.page}
            className={`${item.special ? "bottom-special" : ""} ${isActive ? "active" : ""}`}
            onClick={() => go(item.path)}
            aria-label={item.label}
          >
            {item.special ? (
              <motion.span
                className="favorite-bubble"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Icon size={25} fill={isActive ? "currentColor" : "none"} />
              </motion.span>
            ) : (
              <Icon size={21} fill={isActive && item.page === "home" ? "currentColor" : "none"} />
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>ValoraStream adalah ruang streaming anime dan donghua serta membaca comic subtitle Indonesia dalam satu tempat yang simpel dan cepat.</p>
      </div>
      <div className="footer-links">
        <button onClick={() => go("library?type=anime&filter=ongoing")}>Anime</button>
        <button onClick={() => go("library?type=donghua&filter=latest")}>Donghua</button>
        <button onClick={() => go("library?type=comic&filter=latest")}>Comic</button>
        <button onClick={() => go("favorite")}>Favorit</button>
      </div>
      <div className="footer-about">
        <p className="footer-credit">Dikembangkan oleh hanz.</p>
        <p className="footer-credit">Data disediakan oleh Sanka Vollerei API.</p>
      </div>
    </footer>
  );
}

function Poster({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) {
    return (
      <span className={`poster-fallback ${className}`} aria-label={alt}>
        <Film size={34} />
      </span>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function LoadingState({ label = "Menyiapkan koleksi" }: { label?: string }) {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={29} />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <CircleAlert size={30} />
      <div><strong>Data belum bisa dimuat</strong><p>{message}</p></div>
      <button className="icon-button" onClick={() => window.location.reload()} aria-label="Muat ulang">
        <RefreshCw size={18} />
      </button>
    </div>
  );
}

function TypeTabs({ value, onChange }: { value: ContentType; onChange: (type: ContentType) => void }) {
  return (
    <div className="type-tabs" role="tablist" aria-label="Jenis koleksi">
      {(["anime", "donghua", "comic"] as ContentType[]).map((type) => (
        <button
          key={type}
          className={value === type ? "active" : ""}
          onClick={() => onChange(type)}
          role="tab"
          aria-selected={value === type}
        >
          {type === "anime" && <Tv size={18} />}
          {type === "donghua" && <MonitorPlay size={18} />}
          {type === "comic" && <BookOpen size={18} />}
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function MediaCard({
  item,
  favorite,
  onToggle,
  index = 0,
}: {
  item: MediaItem;
  favorite: boolean;
  onToggle: (item: MediaItem) => void;
  index?: number;
}) {
  return (
    <motion.article
      className="media-card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.24) }}
    >
      <button className="media-main" onClick={() => go(itemPath(item))}>
        <span className="media-image-wrap">
          <Poster src={item.image} alt={item.title} />
          <span className={`type-tag type-${item.type}`}>{TYPE_LABELS[item.type]}</span>
          <span className="play-peek"><Play size={20} fill="currentColor" /></span>
        </span>
        <span className="media-copy">
          <strong>{item.title}</strong>
          <span>{item.meta || TYPE_LABELS[item.type]}</span>
        </span>
      </button>
      <button
        className={`card-favorite ${favorite ? "active" : ""}`}
        onClick={() => onToggle(item)}
        aria-label={favorite ? `Hapus ${item.title} dari favorit` : `Simpan ${item.title} ke favorit`}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
      {item.score && <span className="score"><Star size={13} fill="currentColor" /> {item.score}</span>}
    </motion.article>
  );
}

function MediaGrid({
  items,
  favorites,
  toggle,
}: {
  items: MediaItem[];
  favorites: FavoriteItem[];
  toggle: (item: MediaItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Layers3 size={44} />
        <h3>Belum ada koleksi</h3>
        <p>Coba kategori atau kata kunci yang berbeda.</p>
      </div>
    );
  }
  const ids = new Set(favorites.map((item) => item.id));
  return (
    <div className="media-grid">
      {items.map((item, index) => (
        <MediaCard key={`${item.id}:${index}`} item={item} favorite={ids.has(item.id)} onToggle={toggle} index={index} />
      ))}
    </div>
  );
}

function HomePage({ favorites, toggle }: { favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const anime = useRemote<Record<string, unknown>>("/anime/home");
  const donghua = useRemote<Record<string, unknown>>("/anime/donghub/home?page=1");
  const comic = useRemote<Record<string, unknown>>("/comic/komikindo/latest/1");

  const animeData = (anime.data?.data || {}) as Record<string, unknown>;
  const donghuaData = (donghua.data?.data || {}) as Record<string, unknown>;
  const ongoing = (animeData.ongoing || {}) as Record<string, unknown>;
  const slider = Array.isArray(donghuaData.slider) ? donghuaData.slider as Record<string, unknown>[] : [];
  const heroRaw = slider[1] || slider[0];
  const hero: MediaItem = heroRaw
    ? normalizeDonghua(heroRaw)
    : {
        id: "anime:enen",
        type: "anime",
        title: "Enen no Shouboutai San no Shou Part 2",
        image: FALLBACK_POSTER,
        slug: "enen-shouboutai-season-3-p2-sub-indo",
        meta: "Anime pilihan",
      };
  const animeItems = (Array.isArray(ongoing.animeList) ? ongoing.animeList : [])
    .slice(0, 10)
    .map((item) => normalizeAnime(item as Record<string, unknown>));
  const donghuaItems = slider.slice(0, 10).map(normalizeDonghua);
  const comicList = Array.isArray(comic.data?.komikList) ? comic.data.komikList as Record<string, unknown>[] : [];
  const comicItems = comicList.slice(0, 10).map(normalizeComic);

  return (
    <main>
      <section className="home-hero">
        <motion.img
          key={hero.image}
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          src={hero.image}
          alt=""
          className="hero-background"
          onError={(event) => {
            const target = event.currentTarget;
            if (target.src !== FALLBACK_POSTER) target.src = FALLBACK_POSTER;
          }}
        />
        <div className="hero-shade" />
        <div className="hero-grain" />
        <div className="hero-content">
          <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            Satu tempat. Tiga dunia cerita.
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
          >
            Valora<span>Stream</span>
          </motion.h1>
          <motion.div
            className="hero-bottom"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div>
              <span className="hero-kicker">Sedang disorot</span>
              <h2>{hero.title}</h2>
              <p>Nikmati anime, donghua, dan comic subtitle Indonesia tanpa kehilangan alur.</p>
            </div>
            <div className="hero-actions">
              <button className="button button-yellow" onClick={() => go(itemPath(hero))}>
                <Play size={19} fill="currentColor" /> Mulai sekarang
              </button>
              <button className="button button-ghost-light" onClick={() => go("library?type=anime&filter=ongoing")}>
                <Library size={18} /> Buka library
              </button>
            </div>
          </motion.div>
        </div>
        <div className="scroll-cue"><ArrowRight size={18} /><span>Geser untuk jelajah</span></div>
      </section>

      <div className="content-shell home-sections">
        <section className="content-section">
          <SectionHeading
            title="Anime yang sedang jalan"
            description="Episode baru yang layak masuk antreanmu."
            action={<button className="text-link" onClick={() => go("library?type=anime&filter=ongoing")}>Lihat semua <ArrowRight size={17} /></button>}
          />
          {anime.loading ? <LoadingState /> : anime.error ? <ErrorState message={anime.error} /> : <MediaGrid items={animeItems} favorites={favorites} toggle={toggle} />}
        </section>

        <section className="content-section color-section">
          <SectionHeading
            title="Masuk ke dunia donghua"
            description="Fantasi kultivasi dengan skala yang lebih besar."
            action={<button className="text-link" onClick={() => go("library?type=donghua&filter=latest")}>Jelajahi <ArrowRight size={17} /></button>}
          />
          {donghua.loading ? <LoadingState /> : donghua.error ? <ErrorState message={donghua.error} /> : <MediaGrid items={donghuaItems} favorites={favorites} toggle={toggle} />}
        </section>

        <section className="content-section">
          <SectionHeading
            title="Comic baru diperbarui"
            description="Lanjut baca saat chapter terbaru mendarat."
            action={<button className="text-link" onClick={() => go("library?type=comic&filter=latest")}>Baca semua <ArrowRight size={17} /></button>}
          />
          {comic.loading ? <LoadingState /> : comic.error ? <ErrorState message={comic.error} /> : <MediaGrid items={comicItems} favorites={favorites} toggle={toggle} />}
        </section>
      </div>
    </main>
  );
}

const libraryFilters: Record<ContentType, { value: string; label: string }[]> = {
  anime: [
    { value: "ongoing", label: "Ongoing" },
    { value: "complete", label: "Complete" },
    { value: "unlimited", label: "A-Z" },
    { value: "genre", label: "Genre" },
  ],
  donghua: [
    { value: "latest", label: "Terbaru" },
    { value: "popular", label: "Popular" },
    { value: "movie", label: "Movie" },
    { value: "list", label: "Semua" },
    { value: "genre", label: "Genre" },
  ],
  comic: [
    { value: "latest", label: "Update" },
    { value: "library", label: "A-Z" },
    { value: "genre", label: "Genre" },
  ],
};

function LibraryPage({ route, favorites, toggle }: { route: RouteInfo; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const rawType = route.query.get("type");
  const type: ContentType = rawType === "donghua" || rawType === "comic" ? rawType : "anime";
  const defaultFilter = type === "anime" ? "ongoing" : "latest";
  const filter = route.query.get("filter") || defaultFilter;
  const page = Math.max(1, Number(route.query.get("page") || "1"));
  const genre = route.query.get("genre") || "";

  let path = "";
  if (type === "anime") {
    if (filter === "genre" && genre) path = `/anime/genre/${encodeURIComponent(genre)}?page=${page}`;
    else if (filter === "unlimited") path = "/anime/unlimited";
    else if (filter !== "genre") path = `/anime/${filter === "complete" ? "complete-anime" : "ongoing-anime"}?page=${page}`;
  } else if (type === "donghua") {
    if (filter === "genre" && genre) path = `/anime/donghub/genre/${encodeURIComponent(genre)}`;
    else if (filter === "list") path = "/anime/donghub/list?sub=&order=";
    else if (filter !== "genre") path = `/anime/donghub/${filter}`;
  } else if (filter !== "genre") {
    path = filter === "library" ? `/comic/komikindo/library?page=${page}` : `/comic/komikindo/latest/${page}`;
  }

  const listing = useRemote<Record<string, unknown>>(path || null);
  const genrePath = type === "anime"
    ? "/anime/genre"
    : type === "comic"
      ? "/comic/komikindo/genres"
      : null;
  const genreState = useRemote<Record<string, unknown>>(filter === "genre" ? genrePath : null);

  let rawItems: Record<string, unknown>[] = [];
  if (listing.data) {
    if (type === "anime") {
      const data = (listing.data.data || {}) as Record<string, unknown>;
      rawItems = Array.isArray(data.animeList) ? data.animeList as Record<string, unknown>[] : [];
    } else if (type === "donghua") {
      rawItems = Array.isArray(listing.data.data) ? listing.data.data as Record<string, unknown>[] : [];
    } else {
      rawItems = Array.isArray(listing.data.komikList) ? listing.data.komikList as Record<string, unknown>[] : [];
    }
  }
  const items = rawItems.map((item) => type === "anime" ? normalizeAnime(item) : type === "donghua" ? normalizeDonghua(item) : normalizeComic(item));
  const pagination = (listing.data?.pagination || {}) as Record<string, unknown>;
  const hasNext = Boolean(pagination.hasNextPage ?? pagination.has_next ?? (items.length >= 15));
  const canPaginate = type !== "donghua";

  const animeGenreData = (genreState.data?.data || {}) as Record<string, unknown>;
  const animeGenres = Array.isArray(animeGenreData.genreList) ? animeGenreData.genreList as Record<string, unknown>[] : [];
  const comicGenres = Array.isArray(genreState.data?.genres) ? genreState.data.genres as Record<string, unknown>[] : [];
  const dongGenres = ["action", "adventure", "fantasy", "romance", "martial-arts", "comedy", "sci-fi"];
  const unlimitedData = (listing.data?.data || {}) as Record<string, unknown>;
  const indexGroups = Array.isArray(unlimitedData.list) ? unlimitedData.list as Record<string, unknown>[] : [];
  const genres = type === "anime"
    ? animeGenres.map((item) => ({ name: String(item.title), value: String(item.genreId) }))
    : type === "comic"
      ? comicGenres.map((item) => ({ name: String(item.name), value: String(item.value) }))
      : dongGenres.map((value) => ({ name: value.replace(/-/g, " "), value }));

  const setType = (next: ContentType) => go(`library?type=${next}&filter=${next === "anime" ? "ongoing" : "latest"}`);
  const setFilter = (next: string) => go(`library?type=${type}&filter=${next}`);

  return (
    <main className="page-main content-shell">
      <div className="page-title-row">
        <div><span className="eyebrow">Koleksi lengkap</span><h1>Library</h1><p>Pilih duniamu, lalu temukan cerita berikutnya.</p></div>
        <TypeTabs value={type} onChange={setType} />
      </div>
      <div className="filter-row" aria-label="Filter koleksi">
        {libraryFilters[type].map((item) => (
          <button key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>
        ))}
      </div>

      {filter === "genre" && !genre ? (
        <section className="genre-directory">
          <SectionHeading title={`Genre ${TYPE_LABELS[type]}`} description="Pilih genre untuk membuka jalur cerita yang lebih spesifik." />
          {genreState.loading ? <LoadingState /> : genreState.error ? <ErrorState message={genreState.error} /> : (
            <div className="genre-list">
              {genres.map((item, index) => (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.015, 0.25) }}
                  key={`${item.value}:${index}`}
                  onClick={() => type === "comic"
                    ? go(`search?type=comic&q=${encodeURIComponent(item.name)}`)
                    : go(`library?type=${type}&filter=genre&genre=${encodeURIComponent(item.value)}`)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>{item.name}<ArrowRight size={17} />
                </motion.button>
              ))}
            </div>
          )}
        </section>
      ) : filter === "unlimited" ? (
        <section className="anime-directory">
          <SectionHeading title="Indeks anime A-Z" description="Cari anime berdasarkan huruf awal tanpa batas halaman." />
          {listing.loading ? <LoadingState label="Menyusun indeks anime" /> : listing.error ? <ErrorState message={listing.error} /> : (
            <div className="anime-index">
              {indexGroups.map((group) => {
                const groupItems = Array.isArray(group.animeList) ? group.animeList as Record<string, unknown>[] : [];
                return <div key={String(group.startWith)}><strong>{String(group.startWith)}</strong><div>{groupItems.map((entry) => <button key={String(entry.animeId)} onClick={() => go(`detail/anime/${encodeURIComponent(String(entry.animeId))}`)}>{cleanTitle(String(entry.title))}<ArrowRight size={15} /></button>)}</div></div>;
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="library-results">
          <SectionHeading
            title={genre ? `${TYPE_LABELS[type]} genre ${genre.replace(/-/g, " ")}` : libraryFilters[type].find((item) => item.value === filter)?.label || "Semua"}
            description={`Halaman ${page} dari koleksi ${TYPE_LABELS[type].toLowerCase()}.`}
          />
          {listing.loading ? <LoadingState label="Membuka library" /> : listing.error ? <ErrorState message={listing.error} /> : <MediaGrid items={items} favorites={favorites} toggle={toggle} />}
          {canPaginate && !listing.loading && !listing.error && items.length > 0 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => go(`library?type=${type}&filter=${filter}${genre ? `&genre=${genre}` : ""}&page=${page - 1}`)}><ChevronLeft size={18} /> Sebelumnya</button>
              <span>{page}</span>
              <button disabled={!hasNext} onClick={() => go(`library?type=${type}&filter=${filter}${genre ? `&genre=${genre}` : ""}&page=${page + 1}`)}>Berikutnya <ChevronRight size={18} /></button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function FavoriteButton({ item, favorites, toggle }: { item: MediaItem; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const active = favorites.some((favorite) => favorite.id === item.id);
  return (
    <button className={`button ${active ? "button-yellow" : "button-light"}`} onClick={() => toggle(item)}>
      <Heart size={19} fill={active ? "currentColor" : "none"} /> {active ? "Tersimpan" : "Tambah favorit"}
    </button>
  );
}

function DetailBackdrop({ image, title, children }: { image: string; title: string; children: ReactNode }) {
  return (
    <section className="detail-hero">
      <Poster src={image} alt="" className="detail-background" />
      <div className="detail-shade" />
      <div className="detail-hero-content">
        <button className="back-link" onClick={() => history.back()}><ArrowLeft size={18} /> Kembali</button>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

function DetailAnime({ slug, favorites, toggle }: { slug: string; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const state = useRemote<Record<string, unknown>>(`/anime/anime/${encodeURIComponent(slug)}`);
  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Membuka detail anime" /></main>;
  if (state.error || !state.data) return <main className="page-main content-shell"><ErrorState message={state.error || "Anime tidak ditemukan"} /></main>;
  const d = state.data.data as Record<string, unknown>;
  const item: MediaItem = {
    id: `anime:${slug}`, type: "anime", title: cleanTitle(String(d.title)), image: String(d.poster || FALLBACK_POSTER), slug,
    meta: `${String(d.status || "Anime")} - ${String(d.episodes || "?")} episode`,
  };
  const genres = Array.isArray(d.genreList) ? d.genreList as Record<string, unknown>[] : [];
  const episodes = Array.isArray(d.episodeList) ? d.episodeList as Record<string, unknown>[] : [];
  const recommended = Array.isArray(d.recommendedAnimeList) ? d.recommendedAnimeList as Record<string, unknown>[] : [];
  const synopsis = (d.synopsis || {}) as Record<string, unknown>;
  const paragraphs = Array.isArray(synopsis.paragraphs) ? synopsis.paragraphs.map(String) : [];
  const batch = d.batch as Record<string, unknown> | null;

  return (
    <main>
      <DetailBackdrop image={item.image} title={item.title}>
        <div className="detail-meta"><span>{String(d.type || "TV")}</span><span>{String(d.status || "Unknown")}</span><span><Star size={15} fill="currentColor" /> {String(d.score || "N/A")}</span><span>{String(d.duration || "")}</span></div>
        <div className="detail-actions">
          {episodes[0] && <button className="button button-yellow" onClick={() => go(`watch/anime/${encodeURIComponent(String(episodes[0].episodeId))}`)}><Play size={19} fill="currentColor" /> Tonton episode terbaru</button>}
          <FavoriteButton item={item} favorites={favorites} toggle={toggle} />
        </div>
      </DetailBackdrop>
      <div className="content-shell detail-body">
        <section className="detail-intro">
          <Poster src={item.image} alt={item.title} className="detail-poster" />
          <div>
            <span className="eyebrow">Tentang serial</span>
            <h2>Sinopsis</h2>
            <p>{paragraphs.join("\n\n") || "Sinopsis untuk judul ini belum tersedia dari sumber data."}</p>
            <div className="genre-inline">{genres.map((genre) => <button key={String(genre.genreId)} onClick={() => go(`library?type=anime&filter=genre&genre=${String(genre.genreId)}`)}>{String(genre.title)}</button>)}</div>
            <dl className="info-line"><div><dt>Studio</dt><dd>{String(d.studios || "-")}</dd></div><div><dt>Tayang</dt><dd>{String(d.aired || "-")}</dd></div><div><dt>Judul Jepang</dt><dd>{String(d.japanese || "-")}</dd></div></dl>
          </div>
        </section>
        <section className="episode-section">
          <SectionHeading title="Daftar episode" description={`${episodes.length} episode tersedia untuk ditonton.`} action={batch && <button className="text-link" onClick={() => go(`batch/${encodeURIComponent(String(batch.batchId || batch.slug || ""))}`)}><Download size={17} /> Batch</button>} />
          <div className="episode-list">
            {episodes.map((episode, index) => (
              <button key={String(episode.episodeId)} onClick={() => go(`watch/anime/${encodeURIComponent(String(episode.episodeId))}`)}>
                <span>{String(episode.eps || episodes.length - index).padStart(2, "0")}</span>
                <strong>{cleanTitle(String(episode.title))}</strong>
                <small>{String(episode.date || "Tonton")}</small><Play size={17} fill="currentColor" />
              </button>
            ))}
          </div>
        </section>
        {recommended.length > 0 && <section className="content-section"><SectionHeading title="Rekomendasi berikutnya" /><MediaGrid items={recommended.slice(0, 6).map(normalizeAnime)} favorites={favorites} toggle={toggle} /></section>}
      </div>
    </main>
  );
}

function DetailDonghua({ slug, favorites, toggle }: { slug: string; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const state = useRemote<Record<string, unknown>>(`/anime/donghub/detail/${encodeURIComponent(slug)}`);
  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Membuka detail donghua" /></main>;
  if (state.error || !state.data) return <main className="page-main content-shell"><ErrorState message={state.error || "Donghua tidak ditemukan"} /></main>;
  const d = state.data.data as Record<string, unknown>;
  const info = (d.info || {}) as Record<string, unknown>;
  const episodes = Array.isArray(d.episodes) ? d.episodes as Record<string, unknown>[] : [];
  const genres = Array.isArray(d.genres) ? d.genres as Record<string, unknown>[] : [];
  const item: MediaItem = { id: `donghua:${slug}`, type: "donghua", title: cleanTitle(String(d.title)), image: String(d.poster || FALLBACK_POSTER), slug, meta: String(info.status || "Donghua") };
  const latest = episodes[episodes.length - 1];

  return (
    <main>
      <DetailBackdrop image={item.image} title={item.title}>
        <div className="detail-meta"><span>{String(info.type || "ONA")}</span><span>{String(info.status || "Unknown")}</span><span>{String(info.country || "China")}</span><span>{String(info.episodes || episodes.length)} episode</span></div>
        <div className="detail-actions">
          {latest && <button className="button button-yellow" onClick={() => go(`watch/donghua/${encodeURIComponent(String(latest.slug))}`)}><Play size={19} fill="currentColor" /> Tonton terbaru</button>}
          <FavoriteButton item={item} favorites={favorites} toggle={toggle} />
        </div>
      </DetailBackdrop>
      <div className="content-shell detail-body">
        <section className="detail-intro">
          <Poster src={item.image} alt={item.title} className="detail-poster" />
          <div><span className="eyebrow">Tentang serial</span><h2>Sinopsis</h2><p>{String(d.synopsis || "Sinopsis belum tersedia.")}</p>
            <div className="genre-inline">{genres.map((genre) => <button key={String(genre.slug)} onClick={() => go(`library?type=donghua&filter=genre&genre=${String(genre.slug)}`)}>{String(genre.name)}</button>)}</div>
            <dl className="info-line"><div><dt>Studio</dt><dd>{String(info.studio || "-")}</dd></div><div><dt>Network</dt><dd>{String(info.network || "-")}</dd></div><div><dt>Rilis</dt><dd>{String(info.released || "-")}</dd></div></dl>
          </div>
        </section>
        <section className="episode-section">
          <SectionHeading title="Daftar episode" description={`${episodes.length} episode tersedia.`} />
          <div className="episode-list">
            {[...episodes].reverse().map((episode) => <button key={String(episode.slug)} onClick={() => go(`watch/donghua/${encodeURIComponent(String(episode.slug))}`)}><span>{String(episode.episode || "EP")}</span><strong>{cleanTitle(String(episode.title))}</strong><small>{String(episode.date || "Tonton")}</small><Play size={17} fill="currentColor" /></button>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailComic({ slug, favorites, toggle }: { slug: string; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const state = useRemote<Record<string, unknown>>(`/comic/komikindo/detail/${encodeURIComponent(slug)}`);
  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Membuka detail comic" /></main>;
  if (state.error || !state.data) return <main className="page-main content-shell"><ErrorState message={state.error || "Comic tidak ditemukan"} /></main>;
  const d = state.data.data as Record<string, unknown>;
  const detail = (d.detail || {}) as Record<string, unknown>;
  const chapters = Array.isArray(d.chapters) ? d.chapters as Record<string, unknown>[] : [];
  const genres = Array.isArray(d.genres) ? d.genres as Record<string, unknown>[] : [];
  const similar = Array.isArray(d.similarManga) ? d.similarManga as Record<string, unknown>[] : [];
  const item: MediaItem = { id: `comic:${slug}`, type: "comic", title: cleanTitle(String(d.title)), image: String(d.image || FALLBACK_POSTER), slug, meta: String(detail.type || "Comic") };
  const first = d.firstChapter as Record<string, unknown> | undefined;

  return (
    <main>
      <DetailBackdrop image={item.image} title={item.title}>
        <div className="detail-meta"><span>{String(detail.type || "Comic")}</span><span>{String(detail.status || "Unknown")}</span><span><Star size={15} fill="currentColor" /> {String(d.rating || "N/A")}</span><span>{String(detail.author || "")}</span></div>
        <div className="detail-actions">
          {first && <button className="button button-yellow" onClick={() => go(`read/${encodeURIComponent(String(first.slug))}`)}><BookOpen size={19} /> Mulai baca</button>}
          <FavoriteButton item={item} favorites={favorites} toggle={toggle} />
        </div>
      </DetailBackdrop>
      <div className="content-shell detail-body">
        <section className="detail-intro">
          <Poster src={item.image} alt={item.title} className="detail-poster" />
          <div><span className="eyebrow">Tentang comic</span><h2>Ringkasan</h2><p>{String(d.description || "Deskripsi belum tersedia.")}</p>
            <div className="genre-inline">{genres.map((genre) => <button key={String(genre.slug)} onClick={() => go(`search?type=comic&q=${encodeURIComponent(String(genre.name))}`)}>{String(genre.name)}</button>)}</div>
            <dl className="info-line"><div><dt>Penulis</dt><dd>{String(detail.author || "-")}</dd></div><div><dt>Ilustrator</dt><dd>{String(detail.illustrator || "-")}</dd></div><div><dt>Alternatif</dt><dd>{String(detail.alternativeTitle || "-")}</dd></div></dl>
          </div>
        </section>
        <section className="episode-section">
          <SectionHeading title="Daftar chapter" description={`${chapters.length} chapter tersedia untuk dibaca.`} />
          <div className="episode-list chapter-list">{chapters.map((chapter, index) => <button key={String(chapter.slug)} onClick={() => go(`read/${encodeURIComponent(String(chapter.slug))}`)}><span>{String(chapters.length - index).padStart(2, "0")}</span><strong>{cleanTitle(String(chapter.title))}</strong><small>{String(chapter.releaseTime || "Baca")}</small><BookOpen size={17} /></button>)}</div>
        </section>
        {similar.length > 0 && <section className="content-section"><SectionHeading title="Comic serupa" /><MediaGrid items={similar.slice(0, 6).map(normalizeComic)} favorites={favorites} toggle={toggle} /></section>}
      </div>
    </main>
  );
}

function AnimeWatch({ slug }: { slug: string }) {
  const state = useRemote<Record<string, unknown>>(`/anime/episode/${encodeURIComponent(slug)}`);
  const [streamUrl, setStreamUrl] = useState("");
  const [serverLoading, setServerLoading] = useState("");
  const d = state.data?.data as Record<string, unknown> | undefined;
  useEffect(() => { if (d?.defaultStreamingUrl) setStreamUrl(String(d.defaultStreamingUrl)); }, [d?.defaultStreamingUrl]);

  const switchServer = async (serverId: string) => {
    setServerLoading(serverId);
    try {
      const result = await getApi<Record<string, unknown>>(`/anime/server/${encodeURIComponent(serverId)}`);
      const resultData = result.data as Record<string, unknown>;
      if (resultData?.url) setStreamUrl(String(resultData.url));
    } finally {
      setServerLoading("");
    }
  };

  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Menyiapkan pemutar" /></main>;
  if (state.error || !d) return <main className="page-main content-shell"><ErrorState message={state.error || "Episode tidak ditemukan"} /></main>;
  const server = (d.server || {}) as Record<string, unknown>;
  const qualities = Array.isArray(server.qualities) ? server.qualities as Record<string, unknown>[] : [];
  const prev = d.prevEpisode as Record<string, unknown> | undefined;
  const next = d.nextEpisode as Record<string, unknown> | undefined;
  const info = (d.info || {}) as Record<string, unknown>;
  const episodeList = Array.isArray(info.episodeList) ? info.episodeList as Record<string, unknown>[] : [];

  return (
    <main className="watch-page">
      <div className="content-shell watch-shell">
        <button className="back-link dark" onClick={() => d.animeId ? go(`detail/anime/${encodeURIComponent(String(d.animeId))}`) : history.back()}><ArrowLeft size={18} /> Kembali ke detail</button>
        <div className="watch-title"><div><span className="eyebrow">Sekarang menonton</span><h1>{cleanTitle(String(d.title))}</h1></div><span><Clock3 size={16} /> {String(info.duration || d.releaseTime || "")}</span></div>
        <div className="player-frame">{streamUrl ? <iframe src={streamUrl} title={String(d.title)} allowFullScreen allow="autoplay; fullscreen; picture-in-picture" /> : <div className="player-empty"><CircleAlert size={38} /><p>Server streaming belum tersedia.</p></div>}</div>
        <div className="watch-controls">
          <button disabled={!d.hasPrevEpisode || !prev} onClick={() => prev && go(`watch/anime/${encodeURIComponent(String(prev.episodeId))}`)}><ChevronLeft size={18} /> Episode lalu</button>
          <button disabled={!d.hasNextEpisode || !next} onClick={() => next && go(`watch/anime/${encodeURIComponent(String(next.episodeId))}`)}>Episode lanjut <ChevronRight size={18} /></button>
        </div>
        <section className="server-section"><SectionHeading title="Pilih server" description="Ganti kualitas atau server jika video tidak berjalan." />
          <div className="quality-groups">{qualities.map((quality) => {
            const servers = Array.isArray(quality.serverList) ? quality.serverList as Record<string, unknown>[] : [];
            return <div key={String(quality.title)}><strong>{String(quality.title)}</strong><div>{servers.length ? servers.map((item) => <button key={String(item.serverId)} onClick={() => switchServer(String(item.serverId))} disabled={serverLoading === String(item.serverId)}>{serverLoading === String(item.serverId) ? <LoaderCircle className="spin" size={15} /> : <MonitorPlay size={15} />}{String(item.title)}</button>) : <span>Belum tersedia</span>}</div></div>;
          })}</div>
        </section>
        {episodeList.length > 0 && <section className="episode-section dark-list"><SectionHeading title="Episode lainnya" /><div className="episode-list">{episodeList.map((episode) => <button key={String(episode.episodeId)} className={String(episode.episodeId) === slug ? "current" : ""} onClick={() => go(`watch/anime/${encodeURIComponent(String(episode.episodeId))}`)}><span>{String(episode.eps || "EP")}</span><strong>{cleanTitle(String(episode.title))}</strong><Play size={17} /></button>)}</div></section>}
      </div>
    </main>
  );
}

function DonghuaWatch({ slug }: { slug: string }) {
  const state = useRemote<Record<string, unknown>>(`/anime/donghub/episode/${encodeURIComponent(slug)}`);
  const d = state.data?.data as Record<string, unknown> | undefined;
  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Menyiapkan pemutar" /></main>;
  if (state.error || !d) return <main className="page-main content-shell"><ErrorState message={state.error || "Episode tidak ditemukan"} /></main>;
  const streams = Array.isArray(d.streams) ? d.streams as Record<string, unknown>[] : [];
  const [first] = streams;
  const navigation = (d.navigation || {}) as Record<string, unknown>;
  return (
    <main className="watch-page"><div className="content-shell watch-shell">
      <button className="back-link dark" onClick={() => navigation.all_slug ? go(`detail/donghua/${encodeURIComponent(String(navigation.all_slug))}`) : history.back()}><ArrowLeft size={18} /> Kembali ke detail</button>
      <div className="watch-title"><div><span className="eyebrow">Sekarang menonton</span><h1>{cleanTitle(String(d.title))}</h1></div><span><CalendarDays size={16} /> {String(d.release_date || "")}</span></div>
      <StreamSelector streams={streams} initialUrl={first ? String(first.url) : ""} title={String(d.title)} />
      <div className="watch-controls"><button disabled={!navigation.prev_slug} onClick={() => go(`watch/donghua/${encodeURIComponent(String(navigation.prev_slug))}`)}><ChevronLeft size={18} /> Episode lalu</button><button disabled={!navigation.next_slug} onClick={() => go(`watch/donghua/${encodeURIComponent(String(navigation.next_slug))}`)}>Episode lanjut <ChevronRight size={18} /></button></div>
    </div></main>
  );
}

function StreamSelector({ streams, initialUrl, title }: { streams: Record<string, unknown>[]; initialUrl: string; title: string }) {
  const [url, setUrl] = useState(initialUrl);
  return (
    <>
      <div className="player-frame">{url ? <iframe src={url} title={title} allowFullScreen allow="autoplay; fullscreen; picture-in-picture" /> : <div className="player-empty"><CircleAlert size={38} /><p>Server streaming belum tersedia.</p></div>}</div>
      {streams.length > 1 && <div className="stream-tabs">{streams.map((stream) => <button className={String(stream.url) === url ? "active" : ""} key={String(stream.url)} onClick={() => setUrl(String(stream.url))}><MonitorPlay size={16} /> {String(stream.server)}</button>)}</div>}
    </>
  );
}

function ComicReader({ slug }: { slug: string }) {
  const state = useRemote<Record<string, unknown>>(`/comic/komikindo/chapter/${encodeURIComponent(slug)}`);
  const d = state.data?.data as Record<string, unknown> | undefined;
  if (state.loading) return <main className="reader-page"><LoadingState label="Menyusun halaman comic" /></main>;
  if (state.error || !d) return <main className="page-main content-shell"><ErrorState message={state.error || "Chapter tidak ditemukan"} /></main>;
  const images = Array.isArray(d.images) ? d.images as Record<string, unknown>[] : [];
  const navigation = (d.navigation || {}) as Record<string, unknown>;
  return (
    <main className="reader-page">
      <div className="reader-toolbar"><button onClick={() => d.allChapterSlug ? go(`detail/comic/${encodeURIComponent(String(d.allChapterSlug))}`) : history.back()}><X size={20} /> Tutup</button><div><span>Sedang membaca</span><strong>{cleanTitle(String(d.title))}</strong></div><span>{images.length} halaman</span></div>
      <div className="reader-images">{images.map((image, index) => <Poster key={String(image.id || index)} src={String(image.url)} alt={`Halaman ${index + 1}`} />)}</div>
      <div className="reader-navigation"><button disabled={!navigation.prev} onClick={() => go(`read/${encodeURIComponent(String(navigation.prev))}`)}><ChevronLeft size={18} /> Chapter sebelumnya</button><button disabled={!navigation.next} onClick={() => go(`read/${encodeURIComponent(String(navigation.next))}`)}>Chapter berikutnya <ChevronRight size={18} /></button></div>
    </main>
  );
}

function BatchPage({ slug }: { slug: string }) {
  const state = useRemote<Record<string, unknown>>(slug ? `/anime/batch/${encodeURIComponent(slug)}` : null);
  if (state.loading) return <main className="page-main content-shell"><LoadingState label="Menyiapkan batch" /></main>;
  if (state.error || !state.data) return <main className="page-main content-shell"><ErrorState message={state.error || "Batch tidak ditemukan"} /></main>;
  const d = state.data.data as Record<string, unknown>;
  const downloadUrl = (d.downloadUrl || {}) as Record<string, unknown>;
  const formats = Array.isArray(downloadUrl.formats) ? downloadUrl.formats as Record<string, unknown>[] : [];
  return <main className="page-main content-shell"><div className="simple-page-title"><span className="eyebrow">Unduh koleksi</span><h1>{cleanTitle(String(d.title))}</h1><p>Pilih resolusi dan penyedia unduhan yang kamu inginkan.</p></div><div className="download-formats">{formats.map((format) => { const qualities = Array.isArray(format.qualities) ? format.qualities as Record<string, unknown>[] : []; return <section key={String(format.title)}><h2>{String(format.title)}</h2>{qualities.map((quality) => { const urls = Array.isArray(quality.urls) ? quality.urls as Record<string, unknown>[] : []; return <div className="download-row" key={String(quality.title)}><div><strong>{String(quality.title)}</strong><span>{String(quality.size || "")}</span></div><div>{urls.map((link) => <a key={String(link.title)} href={String(link.url)} target="_blank" rel="noreferrer">{String(link.title)} <ExternalLink size={14} /></a>)}</div></div>; })}</section>; })}</div></main>;
}

function SearchPage({ route, favorites, toggle }: { route: RouteInfo; favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const rawType = route.query.get("type");
  const type: ContentType = rawType === "donghua" || rawType === "comic" ? rawType : "anime";
  const query = route.query.get("q") || "";
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  const path = !query ? null : type === "anime"
    ? `/anime/search/${encodeURIComponent(query)}`
    : type === "donghua"
      ? `/anime/donghub/search/${encodeURIComponent(query)}`
      : `/comic/komikindo/search/${encodeURIComponent(query)}/1`;
  const state = useRemote<Record<string, unknown>>(path);
  let rawItems: Record<string, unknown>[] = [];
  if (state.data) {
    if (type === "anime") { const data = (state.data.data || {}) as Record<string, unknown>; rawItems = Array.isArray(data.animeList) ? data.animeList as Record<string, unknown>[] : []; }
    else if (type === "donghua") rawItems = Array.isArray(state.data.data) ? state.data.data as Record<string, unknown>[] : [];
    else rawItems = Array.isArray(state.data.komikList) ? state.data.komikList as Record<string, unknown>[] : [];
  }
  const items = rawItems.map((item) => type === "anime" ? normalizeAnime(item) : type === "donghua" ? normalizeDonghua(item) : normalizeComic(item));
  const submit = (event: FormEvent) => { event.preventDefault(); if (input.trim()) go(`search?type=${type}&q=${encodeURIComponent(input.trim())}`); };
  return (
    <main className="page-main content-shell search-page">
      <div className="simple-page-title"><span className="eyebrow">Temukan cerita</span><h1>Search</h1><p>Cari judul dari seluruh anime, donghua, dan comic.</p></div>
      <form className="big-search" onSubmit={submit}><Search size={24} /><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Cari ${TYPE_LABELS[type].toLowerCase()}...`} aria-label="Kata kunci pencarian" />{input && <button type="button" onClick={() => setInput("")} aria-label="Hapus pencarian"><X size={20} /></button>}<button type="submit">Cari <ArrowRight size={18} /></button></form>
      <TypeTabs value={type} onChange={(next) => go(`search?type=${next}${query ? `&q=${encodeURIComponent(query)}` : ""}`)} />
      <section className="search-results"><SectionHeading title={query ? `Hasil untuk "${query}"` : "Mulai pencarian"} description={query ? `${items.length} judul ditemukan di ${TYPE_LABELS[type]}.` : "Ketik judul yang ingin kamu cari pada kolom di atas."} />
        {state.loading ? <LoadingState label="Mencari di seluruh koleksi" /> : state.error ? <ErrorState message={state.error} /> : query ? <MediaGrid items={items} favorites={favorites} toggle={toggle} /> : <div className="search-prompt"><Search size={52} /><span>Nama judul, seri, atau kata kunci</span></div>}
      </section>
    </main>
  );
}

function SchedulePage({ route }: { route: RouteInfo }) {
  const type: "anime" | "donghua" = route.query.get("type") === "donghua" ? "donghua" : "anime";
  const state = useRemote<Record<string, unknown>>(type === "anime" ? "/anime/schedule" : "/anime/donghub/schedule");
  const [selectedDay, setSelectedDay] = useState("");
  let schedule: { day: string; items: Record<string, unknown>[] }[] = [];
  if (state.data) {
    if (type === "anime") {
      const data = Array.isArray(state.data.data) ? state.data.data as Record<string, unknown>[] : [];
      schedule = data.map((day) => ({ day: String(day.day), items: Array.isArray(day.anime_list) ? day.anime_list as Record<string, unknown>[] : [] }));
    } else {
      const data = (state.data.data || {}) as Record<string, unknown>;
      schedule = Object.entries(data).map(([day, items]) => ({ day, items: Array.isArray(items) ? items as Record<string, unknown>[] : [] }));
    }
  }
  const dayKey = schedule.map((day) => day.day).join("|");
  useEffect(() => {
    if (schedule.length && !schedule.some((day) => day.day === selectedDay)) setSelectedDay(schedule[0].day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);
  const activeSchedule = schedule.find((day) => day.day === selectedDay) || schedule[0];
  return (
    <main className="page-main content-shell schedule-page">
      <div className="page-title-row"><div><span className="eyebrow">Rilis mingguan</span><h1>Jadwal</h1><p>Atur tontonanmu agar tidak ada episode yang terlewat.</p></div><div className="schedule-switch"><button className={type === "anime" ? "active" : ""} onClick={() => go("schedule?type=anime")}><Tv size={17} /> Anime</button><button className={type === "donghua" ? "active" : ""} onClick={() => go("schedule?type=donghua")}><MonitorPlay size={17} /> Donghua</button></div></div>
      {state.loading ? <LoadingState label="Menyusun jadwal mingguan" /> : state.error ? <ErrorState message={state.error} /> : <>
        <div className="day-tabs">{schedule.map((day) => <button key={day.day} className={activeSchedule?.day === day.day ? "active" : ""} onClick={() => setSelectedDay(day.day)}>{translateDay(day.day)}</button>)}</div>
        <section className="schedule-list"><SectionHeading title={translateDay(activeSchedule?.day || "")} description={`${activeSchedule?.items.length || 0} judul dijadwalkan pada hari ini.`} />
          <div>{activeSchedule?.items.map((item, index) => {
            const media = type === "anime" ? normalizeAnime({ ...item, animeId: item.slug }) : normalizeDonghua(item);
            return <motion.button initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.025 }} key={`${media.slug}:${index}`} onClick={() => go(itemPath(media))}><span className="schedule-number">{String(index + 1).padStart(2, "0")}</span><Poster src={media.image} alt={media.title} /><span className="schedule-copy"><strong>{media.title}</strong><small>{type === "anime" ? "Episode baru" : `Episode ${String(item.sub || item.episode || "baru")}`}</small></span><span className="schedule-time"><Clock3 size={15} /> {String(item.release_time || item.episode || "Terjadwal")}</span><ArrowRight size={19} /></motion.button>;
          })}</div>
        </section>
      </>}
    </main>
  );
}

function translateDay(day: string): string {
  const days: Record<string, string> = { Monday: "Senin", Tuesday: "Selasa", Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu", Sunday: "Minggu" };
  return days[day] || day;
}

function FavoritesPage({ favorites, toggle }: { favorites: FavoriteItem[]; toggle: (item: MediaItem) => void }) {
  const [filter, setFilter] = useState<"all" | ContentType>("all");
  const shown = filter === "all" ? favorites : favorites.filter((item) => item.type === filter);
  return (
    <main className="page-main content-shell favorite-page">
      <div className="favorite-title"><motion.div animate={{ rotate: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 4 }}><Heart size={38} fill="currentColor" /></motion.div><div><span className="eyebrow">Koleksi personal</span><h1>Favorite</h1><p>Cerita yang kamu simpan akan tetap ada di perangkat ini.</p></div></div>
      <div className="filter-row"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Semua</button>{(["anime", "donghua", "comic"] as ContentType[]).map((type) => <button key={type} className={filter === type ? "active" : ""} onClick={() => setFilter(type)}>{TYPE_LABELS[type]}</button>)}</div>
      {favorites.length ? <MediaGrid items={shown} favorites={favorites} toggle={toggle} /> : <div className="empty-favorite"><Heart size={56} /><h2>Belum ada yang disimpan</h2><p>Tekan ikon hati pada judul yang ingin kamu temukan lagi nanti.</p><button className="button button-yellow" onClick={() => go("library?type=anime&filter=ongoing")}><Library size={18} /> Jelajahi library</button></div>}
    </main>
  );
}

function NotFoundPage() {
  return <main className="page-main content-shell not-found"><Menu size={50} /><span className="eyebrow">404</span><h1>Halaman tidak ditemukan</h1><p>Alamat ini tidak ada di koleksi ValoraStream.</p><button className="button button-yellow" onClick={() => go("home")}><Home size={18} /> Kembali ke home</button></main>;
}

export default function App() {
  const route = useRoute();
  const { favorites, toggle } = useFavorites();
  const isHome = route.page === "home";
  const isReader = route.page === "read";
  let content: ReactNode;

  if (isHome) content = <HomePage favorites={favorites} toggle={toggle} />;
  else if (route.page === "library") content = <LibraryPage route={route} favorites={favorites} toggle={toggle} />;
  else if (route.page === "favorite") content = <FavoritesPage favorites={favorites} toggle={toggle} />;
  else if (route.page === "search") content = <SearchPage route={route} favorites={favorites} toggle={toggle} />;
  else if (route.page === "schedule") content = <SchedulePage route={route} />;
  else if (route.page === "detail" && route.segments[1] === "anime") content = <DetailAnime slug={route.segments[2] || ""} favorites={favorites} toggle={toggle} />;
  else if (route.page === "detail" && route.segments[1] === "donghua") content = <DetailDonghua slug={route.segments[2] || ""} favorites={favorites} toggle={toggle} />;
  else if (route.page === "detail" && route.segments[1] === "comic") content = <DetailComic slug={route.segments[2] || ""} favorites={favorites} toggle={toggle} />;
  else if (route.page === "watch" && route.segments[1] === "anime") content = <AnimeWatch slug={route.segments[2] || ""} />;
  else if (route.page === "watch" && route.segments[1] === "donghua") content = <DonghuaWatch slug={route.segments[2] || ""} />;
  else if (route.page === "read") content = <ComicReader slug={route.segments[1] || ""} />;
  else if (route.page === "batch") content = <BatchPage slug={route.segments[1] || ""} />;
  else content = <NotFoundPage />;

  return (
    <div className="app">
      {!isReader && <Header homePage={isHome} />}
      <AnimatePresence mode="wait"><motion.div key={route.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>{content}</motion.div></AnimatePresence>
      {!isReader && <Footer />}
      {!isReader && <BottomNav active={route.page} />}
    </div>
  );
}