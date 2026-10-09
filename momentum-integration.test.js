const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plan,brief,handoff}=require('./momentum-integration');
test('missing findings require unresolved work to stay on hold',()=>{
  const p=plan();assert.equal(p.unknown,true);assert.match(p.steps[0].detail,/on hold/);
});
test('combined-site restriction selects separate sites without waiving audience restrictions',()=>{
  const p=plan({parties:[{company_name:'A'},{company_name:'B'}],findings:[{risk_level:'red',activity_key:'same_site'},{risk_level:'yellow',activity_key:'same_email_list'}]});
  assert.equal(p.selected,'sites');assert.match(p.steps[3].detail,/company-originated contacts out/);
  assert.match(p.options.sites.description,/do not remove/);
});
test('manual previews retain unresolved restrictions',()=>{
  const p=plan({review:{status:'needs_documents'},findings:[{risk_level:'red',activity_key:'same_brand'}]},'hub');
  assert.equal(p.selected,'hub');assert.equal(p.unknown,true);assert.match(p.steps[0].detail,/on hold/);
});
test('handoff requires consent and only sends the constructed brief',()=>{
  const p=plan({review:{id:'r1',brand_name:'A & B'},parties:[{company_name:'Example',document_text:'PRIVATE CONTRACT'}],findings:[{risk_level:'green',activity_key:'same_site',evidence_excerpt:'PRIVATE EXCERPT'}]});
  assert.throws(()=>handoff(p,false),/Consent/);
  const url=new URL(handoff(p,true));assert.equal(url.host,'link.captivationhub.com');assert.equal(url.searchParams.get('ba_setup_requirements'),brief(p));assert.doesNotMatch(url.toString(),/PRIVATE/);
});
test('unknown risk values cannot produce a resolved plan',()=>{assert.equal(plan({findings:[{risk_level:'unexpected'}]}).unknown,true);});
