public_root = File.expand_path("public", Dir.pwd)

use Rack::Static, urls: [""], root: public_root, index: 'index.html', header_rules: [
  [ %w{js}, 'Content-Type' => 'application/javascript;charset=utf-8' ],
  [ %w{html}, 'Content-Type' => 'text/html;charset=utf-8'],
  [ %w{css}, 'Content-Type' => 'text/css;charset=utf-8'],
  [ :all, {} ]
]

run lambda { |env|
  [
    200,
    {
      'Content-Type'  => 'text/html;charset=utf-8',
      'Cache-Control' => 'public, max-age=86400'
    },

    File.open('public/index.html', File::RDONLY)
  ]
}
