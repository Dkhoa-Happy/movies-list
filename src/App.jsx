import { useEffect, useState, useRef } from "react";
import { useDebounce } from "react-use";
import { useInfiniteQuery } from "@tanstack/react-query";
import MovieCard from "../components/MovieCard.jsx";
import Search from "../components/Search.jsx";
import Spinner from "../components/Spinner.jsx";
import { getTrendingMovies, updateSearchCount } from "./appwrite.js";

const API_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const API_OPTIONS = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
};

const fetchMovies = async ({ pageParam = 1, query = "" }) => {
  const endpoint = query
    ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${pageParam}`
    : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${pageParam}`;

  const response = await fetch(endpoint, API_OPTIONS);

  if (!response.ok) {
    throw new Error("Failed to fetch movies");
  }

  const data = await response.json();

  if (query && data.results.length > 0) {
    await updateSearchCount(query, data.results[0]);
  }

  return {
    results: data.results || [],
    nextPage: data.page < data.total_pages ? data.page + 1 : undefined,
  };
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [trendingMovies, setTrendingMovies] = useState([]);
  const sentinelRef = useRef(null);

  useDebounce(() => setDebouncedSearchTerm(searchTerm), 500, [searchTerm]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["movies", debouncedSearchTerm],
    queryFn: ({ pageParam = 1 }) =>
      fetchMovies({ pageParam, query: debouncedSearchTerm }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const loadTrendingMovies = async () => {
    try {
      const movies = await getTrendingMovies();
      setTrendingMovies(movies);
    } catch (error) {
      console.error(`Error fetching trending movies: ${error}`);
    }
  };

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      fetchNextPage({ pageParam: 1 });
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [hasNextPage, fetchNextPage]);

  return (
    <main>
      <div className="pattern" />

      <div className="wrapper">
        <header>
          <img src="./hero.png" alt="Hero Banner" />
          <h1>
            Find <span className="text-gradient">Movies</span> You'll Enjoy
            Without the Hassle
          </h1>

          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </header>

        {trendingMovies.length > 0 && (
          <section className="trending">
            <h2>Trending Movies</h2>

            <ul>
              {trendingMovies.map((movie, index) => (
                <li key={movie.$id}>
                  <p>{index + 1}</p>
                  <img src={movie.poster_url} alt={movie.title} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="all-movies">
          <h2>All Movies</h2>

          {isFetching && !isFetchingNextPage ? (
            <Spinner />
          ) : error ? (
            <p className="text-red-500">{error.message}</p>
          ) : (
            <ul>
              {data.pages.map((page) =>
                page.results.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                )),
              )}
            </ul>
          )}

          <div ref={sentinelRef}>
            {isFetchingNextPage && (
              <div className="flex justify-center items-center">
                <Spinner />
              </div>
            )}
            {!hasNextPage && <p>No more movies</p>}
          </div>
        </section>
      </div>
    </main>
  );
};

export default App;
