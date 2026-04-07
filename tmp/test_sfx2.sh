for i in {2001..2050}; do
  url="https://assets.mixkit.co/active_storage/sfx/$i/$i-preview.mp3"
  if curl --output /dev/null --silent --head --fail "$url"; then
    echo "Found: $url"
  fi
done
