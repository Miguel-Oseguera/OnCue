Pod::Spec.new do |s|
  s.name           = 'OncueWearables'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms = {
  :ios => '17.2'
}
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  
  spm_dependency(
  s,
  url: 'https://github.com/facebook/meta-wearables-dat-ios',
  requirement: { kind: 'exactVersion', version: '1.0.0' },
  products: ['MWDATCore']
)

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
