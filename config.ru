public_root = File.expand_path("public", Dir.pwd)

use Rack::Static, root: public_root, index: 'index.html'
run Rack::Directory.new(public_root)
